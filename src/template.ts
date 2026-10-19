import { escapeHtml, formatBps } from './format';
import type { PublicCheckoutConfig, SessionView } from './session';

/**
 * The widget's markup.
 *
 * Every interpolated value is escaped. The surcharge disclosure, branding and
 * store name all come from merchant settings, and a merchant must not be able to
 * script their own checkout page — nor should a compromised setting become an
 * XSS on every shopper.
 */
export function widgetHtml(input: {
  session: SessionView;
  config: PublicCheckoutConfig;
  theme: 'light' | 'dark';
  isTest: boolean;
}): string {
  const { session, config, theme, isTest } = input;
  const brand = config.branding;
  const methods = session.methods.length ? session.methods : ['card'];

  return `
<div class="wzp" data-theme="${theme}" style="--wzp-brand:${escapeHtml(brand.brandColor)};--wzp-accent:${escapeHtml(brand.accentColor)}">
  <div class="wzp__head">
    ${brand.logoUrl
      ? `<img class="wzp__logo" src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.displayName)}">`
      : `<span class="wzp__name">${escapeHtml(brand.displayName)}</span>`}
    ${isTest ? '<span class="wzp__badge" title="No real money will move">Test mode</span>' : ''}
  </div>

  <div class="wzp__error" data-wzp="error" hidden role="alert"></div>

  <!-- 3D Secure renders here. Kept OUTSIDE the form wrapper so hiding the form
       for a challenge never unmounts the card iframes, which would lose the
       card the shopper already typed. -->
  <div class="wzp__threeds" data-wzp="threeds" hidden></div>

  <div data-wzp="form">

  ${methods.length > 1 ? methodTabs(methods) : ''}

  <div data-wzp="saved" hidden>
    <span class="wzp__label">Your saved cards</span>
    <div class="wzp__saved" data-wzp="saved-list"></div>
  </div>

  <div data-wzp="card-panel">
    <div class="wzp__field">
      <label class="wzp__label" for="wzp-number">Card number</label>
      <div class="wzp__bt" id="wzp-number"></div>
    </div>
    <div class="wzp__row">
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-expiry">Expiry</label>
        <div class="wzp__bt" id="wzp-expiry"></div>
      </div>
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-cvc">Security code</label>
        <div class="wzp__bt" id="wzp-cvc"></div>
      </div>
    </div>
    <div class="wzp__field">
      <label class="wzp__label" for="wzp-holder">Name on card</label>
      <input class="wzp__input" id="wzp-holder" data-wzp="holder" autocomplete="cc-name" placeholder="Jane Buyer">
    </div>
  </div>

  <div data-wzp="ach-panel" hidden>
    <div class="wzp__row">
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-routing">Routing number</label>
        <input class="wzp__input" id="wzp-routing" data-wzp="routing" inputmode="numeric" autocomplete="off">
      </div>
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-account">Account number</label>
        <input class="wzp__input" id="wzp-account" data-wzp="account" inputmode="numeric" autocomplete="off">
      </div>
    </div>
  </div>

  ${addressBlock()}

  <div class="wzp__field">
    <label class="wzp__label" for="wzp-email">Email</label>
    <input class="wzp__input" id="wzp-email" data-wzp="email" type="email" autocomplete="email" placeholder="jane@example.com">
  </div>

  ${session.tips.enabled ? tipBlock(session) : ''}

  <div data-wzp="save-card-row" hidden>
    <label class="wzp__check">
      <input type="checkbox" data-wzp="save-card">
      <span>Save this card for next time</span>
    </label>
  </div>

  <div class="wzp__summary" data-wzp="summary"></div>

  ${session.surchargeDisclosure
    ? `<p class="wzp__muted" data-wzp="disclosure">${escapeHtml(session.surchargeDisclosure)}</p>`
    : ''}

  <button class="wzp__pay" data-wzp="pay" type="button" disabled>Pay</button>
  </div>

  ${config.termsUrl
    ? `<p class="wzp__muted">By paying you agree to the <a href="${escapeHtml(config.termsUrl)}" target="_blank" rel="noopener noreferrer">terms</a>.</p>`
    : ''}
</div>`.trim();
}

function methodTabs(methods: string[]): string {
  const label = (m: string) => (m === 'ach' ? 'Bank transfer' : 'Card');
  return `<div class="wzp__tabs" role="tablist" data-wzp="tabs">${methods
    .map(
      (m, i) =>
        `<button class="wzp__tab" type="button" role="tab" data-method="${escapeHtml(m)}" aria-selected="${i === 0}">${label(m)}</button>`,
    )
    .join('')}</div>`;
}

function tipBlock(session: SessionView): string {
  const presets = session.tips.presetBps ?? [];
  return `
  <div class="wzp__field">
    <span class="wzp__label">Add a tip</span>
    <div class="wzp__tips" data-wzp="tips">
      <button class="wzp__tip" type="button" data-tip="none" aria-pressed="true">None</button>
      ${presets
        .map((bps, i) => `<button class="wzp__tip" type="button" data-tip="${i}" aria-pressed="false">${escapeHtml(formatBps(bps))}</button>`)
        .join('')}
      ${session.tips.allowCustom ? '<button class="wzp__tip" type="button" data-tip="custom" aria-pressed="false">Other</button>' : ''}
    </div>
    <input class="wzp__input" data-wzp="tip-custom" type="number" min="0" step="0.01" placeholder="Tip amount" hidden style="margin-top:8px">
  </div>`;
}

function addressBlock(): string {
  return `
  <div class="wzp__field wzp__ac" data-wzp="address">
    <label class="wzp__label" for="wzp-street">Billing address</label>
    <input class="wzp__input" id="wzp-street" data-wzp="street" autocomplete="off" placeholder="Start typing your address">
    <ul class="wzp__list" data-wzp="ac-list" role="listbox" hidden></ul>
    <div class="wzp__row" style="margin-top:10px">
      <input class="wzp__input" data-wzp="house" autocomplete="address-line2" placeholder="Apt / unit">
      <input class="wzp__input" data-wzp="city" autocomplete="address-level2" placeholder="City">
    </div>
    <div class="wzp__row" style="margin-top:10px">
      <input class="wzp__input" data-wzp="state" autocomplete="address-level1" placeholder="State" maxlength="2">
      <input class="wzp__input" data-wzp="postal" autocomplete="postal-code" placeholder="ZIP">
    </div>
    <input type="hidden" data-wzp="country" value="US">
  </div>`;
}

/** The price breakdown. Only ever renders numbers the server computed. */
export function summaryHtml(
  pricing: SessionView['pricing'],
  currency: string,
  locale: string,
  money: (minor: number, currency: string, locale?: string) => string,
): string {
  const line = (label: string, minor: number, cls = '') =>
    `<div class="wzp__line ${cls}"><span>${escapeHtml(label)}</span><span>${escapeHtml(money(minor, currency, locale))}</span></div>`;

  const parts = [line('Subtotal', pricing.subtotalMinor)];
  if (pricing.tipMinor > 0) parts.push(line('Tip', pricing.tipMinor));
  if (pricing.surchargeMinor > 0) parts.push(line('Card surcharge', pricing.surchargeMinor));
  parts.push(line('Total', pricing.totalMinor, 'wzp__line--total'));
  return parts.join('');
}
