/**
 * Basis Theory Elements — the hosted card fields.
 *
 * The card number, expiry and CVC each render in an iframe served by Basis
 * Theory, so the raw card never enters the merchant's page or ours. That is what
 * keeps a merchant in PCI SAQ-A instead of SAQ-D: we can style these fields, but
 * we can never read them.
 *
 * Loaded from Basis Theory's own CDN at runtime rather than bundled, because the
 * script must be the one BT serves for the iframe origins to match.
 */
const BT_SCRIPT = 'https://js.basistheory.com';

export interface BTElement {
  mount(selector: string): Promise<void>;
  unmount?(): void;
  on(event: string, handler: (payload: BTChangeEvent) => void): void;
  clear?(): void;
}

export interface BTChangeEvent {
  complete?: boolean;
  empty?: boolean;
  errors?: Array<{ type?: string; targetId?: string }>;
  /** Card metadata BT can expose WITHOUT revealing the number. */
  cardBrand?: string;
  cardLast4?: string;
  /** The issuer BIN, when BT reports it — drives debit/prepaid surcharge rules. */
  cardBin?: string;
}

export interface BasisTheory {
  createElement(type: string, options: Record<string, unknown>): BTElement;
  createToken?(payload: unknown): Promise<{ id: string }>;
  tokenIntents: {
    create(payload: { type: string; card: unknown }): Promise<{ id: string; card?: Record<string, unknown> }>;
  };
}

type BTWindow = Window & {
  BasisTheory?: { init?: (key: string, opts?: Record<string, unknown>) => Promise<BasisTheory> };
};

let loader: Promise<BasisTheory> | null = null;

/**
 * Load and initialise Basis Theory once per page.
 *
 * Memoised: a page may mount more than one checkout (a cart and an upsell, say),
 * and loading the script twice would create a second set of iframes competing
 * for the same element ids.
 */
export function loadBasisTheory(publicKey: string): Promise<BasisTheory> {
  if (loader) return loader;

  loader = new Promise<BasisTheory>((resolve, reject) => {
    const w = window as BTWindow;

    const init = () => {
      if (!w.BasisTheory?.init) {
        reject(new Error('WIZPay: Basis Theory loaded but did not initialise.'));
        return;
      }
      w.BasisTheory.init(publicKey, { elements: true }).then(resolve, reject);
    };

    if (w.BasisTheory?.init) {
      init();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${BT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', init);
      existing.addEventListener('error', () => reject(scriptError()));
      return;
    }

    const script = document.createElement('script');
    script.src = BT_SCRIPT;
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      // Reset so a later mount can retry — a blocked first load is usually a
      // CSP or ad-blocker problem the merchant can fix without a reload.
      loader = null;
      reject(scriptError());
    };
    document.head.appendChild(script);
  });

  return loader;
}

function scriptError(): Error {
  return new Error(
    `WIZPay: could not load the secure card fields from ${BT_SCRIPT}. ` +
      'If your site sets a Content-Security-Policy, allow https://js.basistheory.com ' +
      'in script-src and https://*.basistheory.com in frame-src.',
  );
}

/** Reset the memoised loader. Testing only. */
export function __resetBasisTheoryLoader(): void {
  loader = null;
}
