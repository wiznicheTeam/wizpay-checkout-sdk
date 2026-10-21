import { escapeHtml, formatBps } from './format.js';
import type { PublicCheckoutConfig, SessionView } from './session.js';

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
  /** Omit the built-in button when the merchant drives payment from their own. */
  hidePayButton?: boolean;
}): string {
  const { session, config, theme, isTest, hidePayButton } = input;
  const brand = config.branding;
  const methods = session.methods.length ? session.methods : ['card'];

  return `
<div class="wzp" data-theme="${theme}" style="--wzp-brand:${escapeHtml(brand.brandColor)};--wzp-accent:${escapeHtml(brand.accentColor)}">
  ${isTest ? '<div class="wzp__head"><span class="wzp__badge" title="No real money will move">Test mode</span></div>' : ''}

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

  ${hidePayButton ? '' : '<button class="wzp__pay" data-wzp="pay" type="button" disabled>Pay</button>'}

  <div class="wzp__powered">
    <span>Powered by</span>
    ${wiznicheMark()}
  </div>
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
    <span class="wzp__label">Billing address</span>

    <label class="wzp__sublabel" for="wzp-street">Street address</label>
    <input class="wzp__input" id="wzp-street" data-wzp="street" autocomplete="address-line1"
           placeholder="788 Mount Vernon Avenue">
    <ul class="wzp__list" data-wzp="ac-list" role="listbox" hidden></ul>

    <div class="wzp__row" style="margin-top:10px">
      <div>
        <label class="wzp__sublabel" for="wzp-apt">Apt / suite <span class="wzp__optional">optional</span></label>
        <input class="wzp__input" id="wzp-apt" data-wzp="apt" autocomplete="address-line2" placeholder="Apt 4B">
      </div>
      <div>
        <label class="wzp__sublabel" for="wzp-city">City</label>
        <input class="wzp__input" id="wzp-city" data-wzp="city" autocomplete="address-level2" placeholder="Columbus">
      </div>
    </div>

    <div class="wzp__row" style="margin-top:10px">
      <div>
        <label class="wzp__sublabel" for="wzp-state">State</label>
        <input class="wzp__input" id="wzp-state" data-wzp="state" autocomplete="address-level1"
               placeholder="OH" maxlength="2">
      </div>
      <div>
        <label class="wzp__sublabel" for="wzp-postal">ZIP code</label>
        <input class="wzp__input" id="wzp-postal" data-wzp="postal" autocomplete="postal-code" placeholder="43203">
      </div>
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

/**
 * The form's shape, rendered immediately while the session, the store config
 * and the vault's iframes load.
 *
 * `aria-hidden`, because there is nothing here to read: the live region that
 * replaces it announces itself when the real form arrives.
 */
export function skeletonHtml(theme: 'light' | 'dark'): string {
  const field = (labelWidth: string) =>
    `<div class="wzp__sk wzp__sk--label" style="width:${labelWidth}"></div><div class="wzp__sk wzp__sk--field"></div>`;

  return `
<div class="wzp wzp__skeleton" data-theme="${theme}" aria-hidden="true">
  ${field('30%')}
  <div class="wzp__row">
    <div>${field('52%')}</div>
    <div>${field('58%')}</div>
  </div>
  ${field('34%')}
  ${field('26%')}
  <div class="wzp__sk wzp__sk--field"></div>
  <div class="wzp__sk wzp__sk--pay"></div>
</div>`.trim();
}

/**
 * The Wizniche mark, inline.
 *
 * Inline rather than an <img>: it costs no request on a payment page, and a
 * merchant with a strict Content-Security-Policy needs no img-src entry for it.
 * `currentColor` so it reads in both themes instead of sitting at brand blue on
 * a dark background.
 */
export function wiznicheMark(): string {
  return `<svg class="wzp__poweredmark" viewBox="0 0 24 24" role="img" aria-label="Wizniche" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24ZM6.14686 14.6879L6.13682 14.6807C5.97472 14.564 5.86013 14.4044 5.78581 14.2204L5.78337 14.2143L3.82011 8.78533L3.8174 8.77638C3.79575 8.70493 3.77418 8.61819 3.77236 8.53251C3.76246 8.32228 3.83626 8.12593 3.99917 7.97925C4.16002 7.83444 4.3583 7.77148 4.5655 7.77148C4.74319 7.77148 4.91214 7.82315 5.05749 7.9322C5.19473 8.03517 5.2932 8.17168 5.3492 8.333L5.35014 8.33571L6.69478 12.3135L8.04591 8.35461C8.1054 8.1744 8.22045 8.02964 8.37797 7.9278C8.53534 7.82437 8.7124 7.77148 8.90077 7.77148C9.08556 7.77148 9.26036 7.82252 9.4138 7.92777C9.57354 8.02681 9.69466 8.17005 9.75562 8.3546L11.1068 12.3135L12.4523 8.33299C12.5083 8.17168 12.6068 8.03517 12.744 7.9322C12.8894 7.82315 13.0583 7.77148 13.236 7.77148C13.4381 7.77148 13.6356 7.83171 13.7925 7.97918C13.9574 8.12144 14.0392 8.31644 14.0292 8.53245C14.0274 8.61814 14.0058 8.70491 13.9841 8.77638L13.9814 8.78533L12.0182 14.2143L12.0157 14.2204C11.939 14.4103 11.817 14.5713 11.6459 14.6868L11.6429 14.6889C11.4788 14.7973 11.2928 14.8463 11.0984 14.8463C10.8975 14.8463 10.7085 14.791 10.539 14.6832L10.5293 14.677L10.5199 14.6702C10.3577 14.5515 10.2388 14.3941 10.1744 14.2026L8.90077 10.5703L7.62714 14.2026C7.56046 14.4006 7.43319 14.5591 7.26338 14.676L7.26074 14.6779C7.09353 14.7908 6.90422 14.8463 6.70317 14.8463C6.50852 14.8463 6.32342 14.7972 6.15738 14.6945L6.14686 14.6879ZM19.9918 8.5449C19.4855 8.02929 18.8242 7.77148 18.0076 7.77148C17.5504 7.77148 17.1299 7.86869 16.7461 8.0631C16.3705 8.25751 16.0725 8.53222 15.852 8.88723V7.89827H14.7375V14.8463H15.852V11.0046C15.852 10.2777 16.0235 9.72404 16.3664 9.34367C16.7175 8.96331 17.187 8.77312 17.7749 8.77312C18.3547 8.77312 18.8119 8.95908 19.1467 9.331C19.4814 9.69446 19.6488 10.2227 19.6488 10.9159V14.8463H20.7511V10.751C20.7511 9.78744 20.498 9.05206 19.9918 8.5449Z"/></svg>`;
}
