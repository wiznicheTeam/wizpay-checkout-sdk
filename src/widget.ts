import { AddressInput } from './address.js';
import { loadBasisTheory, type BTChangeEvent, type BTElement, type BasisTheory } from './elements.js';
import { formatMoney } from './format.js';
import { resolveMode } from './environment.js';
import { injectStyles, resolveTheme } from './styles.js';
import { isNativeThreeDS, runThreeDS, type ThreeDSAction } from './threeds.js';
import { summaryHtml, widgetHtml } from './template.js';
import {
  CheckoutSessionClient,
  collectBrowserInfo,
  type ConfirmResult,
  type Pricing,
  type PublicCheckoutConfig,
  type SavedMethod,
  type SessionView,
  type TipChoice,
} from './session.js';

export interface MountOptions {
  publishableKey: string;
  sessionId: string;
  clientSecret: string;
  /** CSS selector or element to render into. */
  selector: string | HTMLElement;
  /** Point at another WIZPay deployment. Most integrations never set this. */
  apiBase?: string;
  /**
   * Where the 3D Secure return page is served from. Defaults to the CDN the
   * SDK ships on. Must be an origin WIZPay controls — the checkout pins it when
   * accepting the issuer's result.
   */
  threeDSReturnUrl?: string;
  onSuccess?: (result: ConfirmResult) => void;
  onError?: (error: Error) => void;
  /** Fires whenever the total changes (method, tip, or card type). */
  onPricingChange?: (pricing: Pricing) => void;
}

/**
 * The mounted checkout.
 *
 * Holds no card data at any point: the number, expiry and CVC live in Basis
 * Theory's iframes, and this code only ever sees a token-intent id. It also
 * holds no prices of its own — every total displayed comes from a server quote,
 * so what the shopper sees and what is charged are the same computation.
 */
export class CheckoutWidget {
  private readonly client: CheckoutSessionClient;
  private readonly isTest: boolean;
  private root!: HTMLElement;
  private bt?: BasisTheory;
  private elements: Record<string, BTElement> = {};
  private address?: AddressInput;

  private session!: SessionView;
  private config!: PublicCheckoutConfig;
  private pricing!: Pricing;

  private method = 'card';
  private tip: TipChoice | undefined;
  private funding = 'unknown';
  /**
   * Completeness of EACH card field, not just the number.
   *
   * Tracking the number alone enabled Pay as soon as the PAN was typed, so a
   * half-finished expiry or a 4-digit CVC on a Visa went to the vault and came
   * back as an opaque 400. The form has to know all three are valid before it
   * offers to charge anything.
   */
  /**
   * Resolved once, against the element we mount into, so the form's own markup
   * and Basis Theory's iframes cannot disagree about which theme is in play.
   */
  private theme: 'light' | 'dark' = 'light';

  private cardFields: Record<'number' | 'expiry' | 'cvc', boolean> = {
    number: false,
    expiry: false,
    cvc: false,
  };
  private savedMethodId: string | undefined;
  private busy = false;
  private destroyed = false;

  constructor(private readonly options: MountOptions) {
    // Throws on a secret key, with the consequence spelled out.
    this.isTest = resolveMode(options.publishableKey) === 'test';
    this.client = new CheckoutSessionClient(
      options.publishableKey,
      options.sessionId,
      options.clientSecret,
      { apiBase: options.apiBase },
    );
  }

  async mount(): Promise<void> {
    this.root = resolveElement(this.options.selector);
    injectStyles();

    this.session = await this.client.load();
    this.config = await this.client.config(sessionStoreId(this.session));
    this.pricing = this.session.pricing;
    this.method = this.session.methods[0] ?? 'card';
    // Resolve against the real mount point, while it is still empty, so 'auto'
    // reads the merchant's own background rather than the widget's.
    this.theme = resolveTheme(this.config.theme, this.root);

    this.root.innerHTML = widgetHtml({
      session: this.session,
      config: this.config,
      theme: this.theme,
      isTest: this.isTest,
    });

    this.bindUi();
    this.renderSummary();
    await this.mountCardFields();
    await this.loadSavedCards();
    this.updatePayButton();
  }

  /** Tear down the iframes and markup. Safe to call more than once. */
  destroy(): void {
    this.destroyed = true;
    for (const el of Object.values(this.elements)) el.unmount?.();
    this.elements = {};
    if (this.root) this.root.innerHTML = '';
  }

  // ── setup ────────────────────────────────────────────────────────────────

  private async mountCardFields(): Promise<void> {
    const key = this.config.basisTheoryPublicKey;
    if (!key) {
      this.fail(new Error('WIZPay: card payments are not configured for this store.'));
      return;
    }

    this.bt = await loadBasisTheory(key);
    const style = btStyle(this.theme);

    this.elements.number = this.bt.createElement('cardNumber', { targetId: 'wzp-number', style });
    this.elements.expiry = this.bt.createElement('cardExpirationDate', { targetId: 'wzp-expiry', style });
    this.elements.cvc = this.bt.createElement('cardVerificationCode', { targetId: 'wzp-cvc', style });

    await Promise.all([
      this.elements.number!.mount('#wzp-number'),
      this.elements.expiry!.mount('#wzp-expiry'),
      this.elements.cvc!.mount('#wzp-cvc'),
    ]);

    // The card number element reports brand and BIN WITHOUT exposing the number.
    // The BIN is what lets us re-quote before charging, so a debit card drops its
    // surcharge in front of the shopper rather than surprising them on the receipt.
    this.elements.number!.on('change', (event: BTChangeEvent) => {
      this.cardFields.number = Boolean(event.complete);
      this.updatePayButton();
      const funding = fundingFromEvent(event);
      if (funding !== this.funding) {
        this.funding = funding;
        void this.requote();
      }
    });

    for (const name of ['expiry', 'cvc'] as const) {
      this.elements[name]!.on('change', (event: BTChangeEvent) => {
        this.cardFields[name] = Boolean(event.complete);
        this.updatePayButton();
      });
    }
  }

  private async loadSavedCards(): Promise<void> {
    if (!this.session.methods.includes('card')) return;
    try {
      const { paymentMethods } = await this.client.savedMethods();
      if (paymentMethods.length === 0) return;
      this.renderSavedCards(paymentMethods);
      this.show('save-card-row');
    } catch {
      // A session without a customer has no saved cards; that is not an error,
      // and a shopper who has never paid here before must not see one.
      this.show('save-card-row');
    }
  }

  // ── pricing ──────────────────────────────────────────────────────────────

  /** Ask the SERVER what this costs. The widget never computes a total. */
  private async requote(): Promise<void> {
    try {
      this.pricing = await this.client.quote({
        method: this.method,
        funding: this.funding,
        tip: this.tip,
      });
      this.renderSummary();
      this.options.onPricingChange?.(this.pricing);
    } catch (error) {
      this.fail(error as Error);
    }
  }

  private renderSummary(): void {
    const el = this.q('summary');
    if (el) {
      el.innerHTML = summaryHtml(this.pricing, this.session.currency, this.config.locale, formatMoney);
    }
    const pay = this.q<HTMLButtonElement>('pay');
    if (pay) {
      pay.textContent = `Pay ${formatMoney(this.pricing.totalMinor, this.session.currency, this.config.locale)}`;
    }
  }

  // ── payment ──────────────────────────────────────────────────────────────

  private async pay(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.updatePayButton();
    this.clearError();

    try {
      const result = await this.client.confirm({
        method: this.method,
        tip: this.tip,
        ...(this.savedMethodId
          ? { savedMethodId: this.savedMethodId }
          : { tokenIntentId: await this.tokenize() }),
        ...(this.method === 'ach'
          ? { accountHolderName: this.q<HTMLInputElement>('holder')?.value.trim() }
          : {}),
        saveCard: this.q<HTMLInputElement>('save-card')?.checked ?? false,
        holderName: this.q<HTMLInputElement>('holder')?.value.trim(),
        email: this.q<HTMLInputElement>('email')?.value.trim(),
        billingAddress: { ...(this.address?.value() ?? {}) },
        browserInfo: collectBrowserInfo(),
      });

      if (result.status === 'requires_action') {
        await this.handleAction(result);
        return;
      }
      if (result.status === 'succeeded' && this.method === 'ach') {
        // An ACH debit is not instant. Telling the shopper it is "paid" invites
        // a support ticket when it settles days later.
        this.showNotice('Your bank transfer has started. It usually clears in a few business days.');
      }
      if (result.status === 'failed') {
        // A decline is recoverable: keep the form, show why, let them retry.
        this.showError(result.failureReason ?? 'Your payment was declined. Please try another card.');
        return;
      }
      this.options.onSuccess?.(result);
    } catch (error) {
      this.fail(error as Error);
    } finally {
      this.busy = false;
      this.updatePayButton();
    }
  }

  /**
   * Send the card to Basis Theory and keep only the id.
   *
   * A token INTENT, not a token: it expires on its own in about a day, so an
   * abandoned checkout leaves nothing PCI-scoped behind. It is promoted to a
   * durable token only if the shopper asked to save the card AND the payment
   * succeeded.
   */
  private async tokenize(): Promise<string> {
    if (!this.bt) throw new Error('WIZPay: secure card fields are not ready yet.');

    // ACH vaults the bank account the same way a card is vaulted: account and
    // routing numbers are as sensitive as a PAN, so they go straight to the
    // vault and this page only ever holds the resulting id.
    if (this.method === 'ach') return this.tokenizeBank();

    const expiry = this.elements.expiry!;
    if (typeof expiry.month !== 'function' || typeof expiry.year !== 'function') {
      throw new Error('WIZPay: the secure expiry field did not initialise correctly.');
    }

    const intent = await this.bt.tokenIntents.create({
      type: 'card',
      // `data`, not `card`: the vault rejects anything else with
      // "'data' or 'encrypted' is required".
      data: {
        number: this.elements.number,
        // One element holds "MM / YY". Handing it to BOTH fields sent
        // expiration_month and expiration_year as the same "03 / 30" string.
        expiration_month: expiry.month(),
        expiration_year: expiry.year(),
        cvc: this.elements.cvc,
      },
    });
    return intent.id;
  }

  /**
   * Vault the bank account for an ACH debit.
   *
   * These are plain inputs rather than vault-hosted iframes, because a routing
   * and account number are not under the card schemes' iframe requirement. They
   * still never reach the merchant's server or ours: the values go straight to
   * the vault and only the id comes back.
   */
  private async tokenizeBank(): Promise<string> {
    const routing = this.q<HTMLInputElement>('routing')?.value.trim() ?? '';
    const account = this.q<HTMLInputElement>('account')?.value.trim() ?? '';
    // Check locally first: a malformed number is a certain decline days later,
    // and ACH gives no immediate feedback to correct it.
    if (!/^\d{9}$/.test(routing)) throw new Error('WIZPay: a US routing number is 9 digits.');
    if (!/^\d{4,17}$/.test(account)) throw new Error('WIZPay: check the account number.');

    const res = await fetch('https://api.basistheory.com/token-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'BT-API-KEY': this.config.basisTheoryPublicKey as string },
      body: JSON.stringify({ type: 'bank', data: { routing_number: routing, account_number: account } }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok || !body.id) throw new Error('WIZPay: could not securely store those bank details.');
    return body.id;
  }

  /**
   * The shopper's bank wants to verify the payment.
   *
   * Native 3DS2 runs in an iframe on this page: usually invisibly, and with a
   * visible step only when the issuer insists. Falling back to a redirect only
   * when the provider gives us nothing else, because sending a shopper away to
   * their bank loses a meaningful share of them.
   */
  private async handleAction(result: ConfirmResult): Promise<void> {
    const action = result.action as ThreeDSAction | undefined;

    if (isNativeThreeDS(action)) {
      await this.runNativeThreeDS(action as ThreeDSAction);
      return;
    }

    const url = action?.url;
    if (typeof url === 'string' && url) {
      window.location.assign(url);
      return;
    }
    this.showError('Your bank needs to verify this payment, but we could not open the verification step.');
  }

  /** Run the issuer's 3DS2 step, then hand the result back to the API. */
  private async runNativeThreeDS(action: ThreeDSAction): Promise<void> {
    const container = this.q('threeds');
    if (!container) return;

    const challenge = action.subtype === 'challenge';
    // Only take over the form for a step the shopper can actually see.
    if (challenge) {
      this.toggle('threeds', true);
      this.setFormVisible(false);
    }

    try {
      const { details } = await runThreeDS(action, {
        returnPageUrl: this.options.threeDSReturnUrl ?? DEFAULT_THREEDS_RETURN,
        container,
      });

      const settled = await this.client.details(details);
      if (settled.status === 'succeeded') {
        this.options.onSuccess?.(settled);
        return;
      }
      if (settled.status === 'requires_action') {
        // The issuer asked for a second step: fingerprint, then challenge.
        await this.runNativeThreeDS(settled.action as ThreeDSAction);
        return;
      }
      this.restoreAfterChallenge(challenge);
      this.showError(settled.failureReason ?? 'Your bank could not verify this payment.');
    } catch (error) {
      this.restoreAfterChallenge(challenge);
      this.fail(error as Error);
    }
  }

  private restoreAfterChallenge(wasChallenge: boolean): void {
    if (!wasChallenge) return;
    this.toggle('threeds', false);
    this.setFormVisible(true);
  }

  /** Hide the form behind the challenge without unmounting the card iframes —
   *  re-mounting them would lose the entered card. */
  private setFormVisible(visible: boolean): void {
    const form = this.q('form');
    if (form) form.hidden = !visible;
  }

  // ── ui wiring ────────────────────────────────────────────────────────────

  private bindUi(): void {
    this.q('pay')?.addEventListener('click', () => void this.pay());

    this.address = new AddressInput(this.root, this.client, () => this.updatePayButton());
    this.address.attach();

    this.q('tabs')?.addEventListener('click', (event) => {
      const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-method]');
      if (!tab) return;
      this.method = tab.dataset.method ?? 'card';
      for (const t of Array.from(this.root.querySelectorAll('[data-method]'))) {
        t.setAttribute('aria-selected', String(t === tab));
      }
      this.toggle('card-panel', this.method === 'card');
      this.toggle('ach-panel', this.method === 'ach');
      this.updatePayButton();
      void this.requote();
    });

    this.q('tips')?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (!button) return;
      const choice = button.dataset.tip;
      for (const b of Array.from(this.root.querySelectorAll('[data-tip]'))) {
        b.setAttribute('aria-pressed', String(b === button));
      }
      const custom = this.q<HTMLInputElement>('tip-custom');
      if (custom) custom.hidden = choice !== 'custom';

      this.tip =
        choice === 'none' ? undefined
        : choice === 'custom' ? { customMinor: toMinor(custom?.value) }
        : { presetIndex: Number(choice) };
      void this.requote();
    });

    this.q('tip-custom')?.addEventListener('input', (event) => {
      this.tip = { customMinor: toMinor((event.target as HTMLInputElement).value) };
      void this.requote();
    });

    for (const name of ['holder', 'email']) {
      this.q(name)?.addEventListener('input', () => this.updatePayButton());
    }
  }

  private renderSavedCards(methods: SavedMethod[]): void {
    const list = this.q('saved-list');
    if (!list) return;

    list.innerHTML = methods
      .map(
        (m) =>
          `<button class="wzp__card" type="button" data-saved="${m.id}" aria-pressed="false">
             <span>${(m.brand ?? 'Card').toUpperCase()} ···· ${m.last4 ?? '••••'}</span>
             <span class="wzp__muted" style="margin-left:auto">${m.expMonth ?? ''}/${m.expYear ?? ''}</span>
           </button>`,
      )
      .join('') + '<button class="wzp__card" type="button" data-saved="new" aria-pressed="true">Use a new card</button>';

    list.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-saved]');
      if (!button) return;
      for (const b of Array.from(list.querySelectorAll('[data-saved]'))) {
        b.setAttribute('aria-pressed', String(b === button));
      }
      const id = button.dataset.saved;
      this.savedMethodId = id === 'new' ? undefined : id;
      // A saved card's funding is known server-side; re-quote so the surcharge
      // shown matches the card actually being charged.
      this.toggle('card-panel', !this.savedMethodId);
      this.toggle('save-card-row', !this.savedMethodId);
      this.updatePayButton();
      void this.requote();
    });

    this.show('saved');
  }

  /**
   * The pay button is enabled only when the request would actually be complete.
   * A shopper who taps Pay and gets a validation error has been failed by the
   * form, not by their card.
   */
  private updatePayButton(): void {
    const pay = this.q<HTMLButtonElement>('pay');
    if (!pay) return;

    const addressOk = this.address?.isComplete() ?? false;
    const instrumentOk =
      this.method === 'ach'
        ? Boolean(this.q<HTMLInputElement>('routing')?.value && this.q<HTMLInputElement>('account')?.value)
        : Boolean(this.savedMethodId) ||
          (this.cardFields.number && this.cardFields.expiry && this.cardFields.cvc);

    pay.disabled = this.busy || this.destroyed || !addressOk || !instrumentOk;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private q<T extends HTMLElement = HTMLElement>(name: string): T | null {
    return this.root?.querySelector<T>(`[data-wzp="${name}"]`) ?? null;
  }

  private toggle(name: string, visible: boolean): void {
    const el = this.q(name);
    if (el) el.hidden = !visible;
  }

  private show(name: string): void {
    this.toggle(name, true);
  }

  /** A non-error message, styled apart from a failure. */
  private showNotice(message: string): void {
    const el = this.q('error');
    if (el) {
      el.textContent = message;
      el.classList.add('wzp__error--notice');
      el.hidden = false;
    }
  }

  private showError(message: string): void {
    const el = this.q('error');
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  private clearError(): void {
    const el = this.q('error');
    if (el) {
      el.hidden = true;
      el.classList.remove('wzp__error--notice');
    }
  }

  private fail(error: Error): void {
    // The shopper sees something they can act on; the merchant still receives
    // the original Error, with its real message and stack, through onError.
    this.showError(shopperMessage(error));
    this.options.onError?.(error);
  }
}

/**
 * Turn any failure into something a shopper can act on.
 *
 * Vault and network errors arrive phrased for whoever wrote the integration:
 * "The API responded with status code 400. Check error.data for more
 * information." was being shown to people trying to buy a drill. It tells them
 * nothing, and it leaks our internals onto a merchant's page.
 *
 * Decline reasons are different: the provider already writes those for the
 * cardholder, so they pass through untouched.
 */
export function shopperMessage(error: Error): string {
  const raw = typeof error?.message === 'string' ? error.message : '';

  // Anything that names a status code, a payload field, or an exception type is
  // developer-facing by construction.
  const developerFacing =
    /status code\s*\d{3}/i.test(raw) ||
    /error\.data|\bundefined\b|\[object |TypeError|SyntaxError/i.test(raw) ||
    raw === '';

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(raw)) {
    return 'We could not reach the payment service. Check your connection and try again.';
  }
  if (/\b4\d{2}\b/.test(raw) && /card|token|vault|basis/i.test(raw)) {
    return 'We could not read your card details. Please check the number, expiry date and security code.';
  }
  if (developerFacing) {
    return 'We could not complete this payment. Please check your details and try again.';
  }

  return raw;
}

/** The SDK's own CDN origin — the checkout pins it when accepting 3DS results. */
const DEFAULT_THREEDS_RETURN = 'https://js.wizpay.ai/v1/3ds-return.html';

function resolveElement(selector: string | HTMLElement): HTMLElement {
  if (typeof selector !== 'string') return selector;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`WIZPay: no element matches "${selector}". Add it before calling mount().`);
  return el;
}

/**
 * The store a session belongs to, for the public-config lookup.
 *
 * Falling back to '' here hid a server bug for a long time: the session view
 * omitted storeId, so the widget cheerfully asked for the config of a store
 * named nothing and surfaced a 404 that pointed at no store at all. Fail with
 * something an integrator can act on instead.
 */
function sessionStoreId(session: SessionView & { storeId?: string }): string {
  const storeId = session.storeId;
  if (!storeId) {
    throw new Error(
      'WIZPay: this session did not say which store it belongs to, so the ' +
        'checkout cannot load that store\'s configuration. Your WIZPay API may ' +
        'predate this field — upgrade it, or contact support.',
    );
  }
  return storeId;
}

/** BT exposes brand/BIN without the number; map it to our funding vocabulary. */
function fundingFromEvent(event: BTChangeEvent): string {
  const raw = (event as { cardFunding?: string }).cardFunding?.toLowerCase();
  return raw === 'credit' || raw === 'debit' || raw === 'prepaid' ? raw : 'unknown';
}

function toMinor(value: string | undefined): number {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) && n > 0 ? Math.round(Number(`${n}e2`)) : 0;
}

function btStyle(theme: 'light' | 'dark'): Record<string, unknown> {
  const color = theme === 'dark' ? '#e9edf2' : '#16191d';
  return {
    base: {
      color,
      fontSize: '15px',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      '::placeholder': { color: theme === 'dark' ? '#9aa6b2' : '#8a94a0' },
    },
    invalid: { color: theme === 'dark' ? '#f97066' : '#b42318' },
  };
}
