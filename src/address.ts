import type { CheckoutSessionClient } from './session.js';

export interface AddressFields {
  street?: string;
  houseNumberOrName?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Billing address with autocomplete, proxied through the WIZPay API.
 *
 * No Google key ever reaches the browser — it could not safely, since this
 * bundle is public and merchants host it on their own domains, where referrer
 * restrictions do not help. A side effect worth having: merchants need no
 * Google entries in their Content-Security-Policy.
 *
 * The address is REQUIRED. It feeds AVS, which measurably improves approval
 * rates, and supplies the destination postcode for L2/L3 interchange data.
 *
 * Manual entry is always available. If the lookup is slow, blocked or simply
 * finds nothing, the shopper must still be able to type an address and pay —
 * an autocomplete failure must never become a failed checkout.
 */
export class AddressInput {
  private readonly token = randomToken();
  private suggestions: Array<{ placeId: string; text: string }> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private manual = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly client: CheckoutSessionClient,
    private readonly onResolved: () => void,
  ) {}

  /** The address as currently entered, whether picked or typed. */
  value(): AddressFields {
    const get = (name: string) => this.root.querySelector<HTMLInputElement>(`[data-wzp="${name}"]`)?.value.trim() ?? '';

    // Shoppers write one line, "788 Mount Vernon Avenue", and an apartment is a
    // separate thing from a street number. The PROCESSOR wants the house number
    // apart from the street name, so split it here rather than making someone
    // type their street number into a box labelled "unit".
    const line = get('street');
    const [, number = '', name = ''] = /^\s*([0-9]+[A-Za-z-]*)\s+(.*)$/.exec(line) ?? [];
    const apt = get('apt');

    return {
      street: name || line,
      houseNumberOrName: [number, apt].filter(Boolean).join(' '),
      city: get('city'),
      stateOrProvince: get('state'),
      postalCode: get('postal'),
      country: get('country') || 'US',
    };
  }

  /** Street and postcode are the parts AVS actually checks. */
  isComplete(): boolean {
    const v = this.value();
    return Boolean(v.street && v.city && v.postalCode);
  }

  attach(): void {
    const search = this.root.querySelector<HTMLInputElement>('[data-wzp="street"]');
    const list = this.root.querySelector<HTMLElement>('[data-wzp="ac-list"]');
    if (!search || !list) return;

    search.addEventListener('input', () => {
      this.onResolved();
      if (this.manual) return;
      clearTimeout(this.timer);
      // Debounced: every keystroke is a billed Places call, and a request per
      // character would also arrive out of order.
      this.timer = setTimeout(() => void this.lookup(search.value, list), 220);
    });

    search.addEventListener('blur', () => setTimeout(() => this.hide(list), 150));

    list.addEventListener('mousedown', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-place-id]');
      if (target) {
        event.preventDefault();
        void this.select(target.dataset.placeId as string, list);
      }
    });
  }

  private async lookup(input: string, list: HTMLElement): Promise<void> {
    if (input.trim().length < 3) return this.hide(list);
    try {
      const { suggestions } = await this.client.autocompleteAddress(input, this.token, this.value().country);
      this.suggestions = suggestions ?? [];
      this.render(list);
    } catch {
      // Degrade to manual entry rather than surfacing a lookup error: the
      // shopper is trying to pay, not to use an address search.
      this.manual = true;
      this.hide(list);
    }
  }

  private render(list: HTMLElement): void {
    if (this.suggestions.length === 0) return this.hide(list);
    list.innerHTML = this.suggestions
      .map((s) => `<li class="wzp__opt" role="option" data-place-id="${escapeAttr(s.placeId)}">${escapeText(s.text)}</li>`)
      .join('');
    list.hidden = false;
  }

  private hide(list: HTMLElement): void {
    list.hidden = true;
    list.innerHTML = '';
  }

  private async select(placeId: string, list: HTMLElement): Promise<void> {
    this.hide(list);
    try {
      const { address } = await this.client.addressDetails(placeId, this.token);
      this.fill(address);
      this.onResolved();
    } catch {
      this.manual = true;
    }
  }

  private fill(address: Record<string, string>): void {
    const set = (name: string, value: string | undefined) => {
      const el = this.root.querySelector<HTMLInputElement>(`[data-wzp="${name}"]`);
      if (el && value) el.value = value;
    };
    // Google returns the number apart from the road. Join them back into the one
    // line a person recognises as their street address; value() splits it again
    // on the way out. The apartment is never Google's to fill.
    set('street', [address.houseNumberOrName, address.street].filter(Boolean).join(' '));
    set('city', address.city);
    set('state', address.stateOrProvince);
    set('postal', address.postalCode);
    set('country', address.country);
  }
}

/** A Google Places session token: bills autocomplete + details as one session. */
function randomToken(): string {
  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const escapeText = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (v: string) => escapeText(v).replace(/"/g, '&quot;');
