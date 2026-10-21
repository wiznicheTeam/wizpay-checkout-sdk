import type { PublicCheckoutConfig } from './session.js';

/**
 * The widget's styles, scoped under `.wzp` and injected once.
 *
 * Scoped rather than inherited on purpose: the widget renders inside someone
 * else's stylesheet, and a merchant's global `input { … }` or `button { … }`
 * rule would otherwise reshape the payment form. Everything here is specific
 * enough to win without `!important`, which would in turn stop merchants making
 * deliberate adjustments.
 *
 * Colours come from the account's brand (Settings → Branding), applied as custom
 * properties so one assignment themes the whole form.
 */
export function widgetStyles(): string {
  return `
.wzp{--wzp-radius:10px;--wzp-gap:14px;max-width:100%;overflow-wrap:break-word;color:var(--wzp-text);background:var(--wzp-surface);font:400 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box}
.wzp *,.wzp *::before,.wzp *::after{box-sizing:inherit}
.wzp[data-theme="light"]{--wzp-text:#16191d;--wzp-muted:#5b6672;--wzp-line:#d9dee4;--wzp-surface:#fff;--wzp-surface-2:#f6f8fa;--wzp-danger:#b42318}
.wzp[data-theme="dark"]{--wzp-text:#e9edf2;--wzp-muted:#9aa6b2;--wzp-line:#2b3440;--wzp-surface:#141922;--wzp-surface-2:#1b2230;--wzp-danger:#f97066}
.wzp__head{display:flex;align-items:center;gap:10px;margin-bottom:var(--wzp-gap)}
.wzp__logo{max-height:28px;max-width:140px}
.wzp__name{font-weight:700}
/* Attribution belongs under the button, not above the form. The merchant's own
   brand owns the top of their checkout; ours only needs to say who handled the
   payment. */
.wzp__powered{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:12px;color:var(--wzp-muted);font-size:11px;letter-spacing:.2px}
.wzp__poweredmark{height:14px;width:14px;opacity:.75;vertical-align:-2px}
.wzp__badge{margin-left:auto;padding:2px 8px;border-radius:999px;background:#fff3cd;color:#8a6100;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.wzp__field{margin-bottom:var(--wzp-gap)}
.wzp__label{display:block;margin-bottom:6px;font-size:13px;font-weight:600}
/* Each address input names itself. A placeholder is not a label: it disappears
   the moment someone types, so a half-filled form stops saying what its fields
   are, and screen readers treat it as a hint rather than a name. */
.wzp__sublabel{display:block;margin:0 0 4px;font-size:12px;font-weight:500;color:var(--wzp-muted)}
.wzp__row>div{min-width:0}
.wzp__optional{font-weight:400;opacity:.75}
.wzp__input,.wzp__bt{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);color:var(--wzp-text);font-size:15px}
.wzp__input:focus{outline:2px solid var(--wzp-brand);outline-offset:1px}
.wzp__bt{padding:0 12px;display:flex;align-items:center}
.wzp__row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wzp__tabs{display:flex;gap:8px;margin-bottom:var(--wzp-gap)}
.wzp__tab{flex:1;min-height:42px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);color:var(--wzp-text);font:inherit;font-weight:600;cursor:pointer}
.wzp__tab[aria-selected="true"]{border-color:var(--wzp-brand);box-shadow:inset 0 0 0 1px var(--wzp-brand)}
.wzp__tips{display:flex;flex-wrap:wrap;gap:8px}
.wzp__tip{flex:1 1 72px;min-height:42px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);color:var(--wzp-text);font:inherit;cursor:pointer}
.wzp__tip[aria-pressed="true"]{border-color:var(--wzp-brand);background:var(--wzp-brand);color:#fff}
.wzp__summary{margin:var(--wzp-gap) 0;padding:12px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface-2)}
.wzp__line{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:3px 0}
.wzp__line--total{margin-top:6px;padding-top:9px;border-top:1px solid var(--wzp-line);font-size:16px;font-weight:700}
.wzp__muted{color:var(--wzp-muted);font-size:13px}
.wzp__pay{width:100%;min-height:48px;border:0;border-radius:var(--wzp-radius);background:var(--wzp-brand);color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
.wzp__pay:disabled{opacity:.55;cursor:not-allowed}
.wzp__pay[data-busy="true"]{cursor:progress}
/* Sits inside the button so its width does not jump between states. */
.wzp__spinner{display:inline-block;width:15px;height:15px;margin-right:8px;vertical-align:-2px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:wzp-spin .7s linear infinite}
@keyframes wzp-spin{to{transform:rotate(360deg)}}

/* The shape of the form, shown while the session, the config and the vault's
   iframes are still loading. A blank box for a second on a payment page reads
   as a broken page, and people leave. */
.wzp__skeleton{display:block}
.wzp__sk{border-radius:var(--wzp-radius);background:var(--wzp-surface-2);animation:wzp-pulse 1.4s ease-in-out infinite}
.wzp__sk--label{height:11px;width:38%;margin-bottom:8px;border-radius:4px}
.wzp__sk--field{height:44px;margin-bottom:var(--wzp-gap)}
.wzp__sk--pay{height:48px;margin-top:4px}
@keyframes wzp-pulse{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){
  .wzp__sk{animation:none}
  .wzp__spinner{animation-duration:2.4s}
}
.wzp__error{margin-bottom:var(--wzp-gap);padding:10px 12px;border-radius:var(--wzp-radius);background:rgba(180,35,24,.1);color:var(--wzp-danger);font-size:14px;overflow-wrap:anywhere}
.wzp__error--notice{background:rgba(0,90,160,.1);color:var(--wzp-brand)}
.wzp__saved{display:flex;flex-direction:column;gap:8px;margin-bottom:var(--wzp-gap)}
.wzp__card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}
.wzp__card[aria-pressed="true"]{border-color:var(--wzp-brand);box-shadow:inset 0 0 0 1px var(--wzp-brand)}
.wzp__check{display:flex;align-items:flex-start;gap:9px;margin-bottom:var(--wzp-gap);font-size:14px;cursor:pointer}
.wzp__ac{position:relative}
.wzp__threeds{min-height:420px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);overflow:hidden;background:var(--wzp-surface)}
.wzp__threeds[hidden]{display:none}
.wzp__list{position:absolute;z-index:20;left:0;right:0;margin-top:2px;padding:0;list-style:none;max-height:210px;overflow:auto;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);box-shadow:0 8px 24px rgba(0,0,0,.14)}
.wzp__opt{padding:9px 12px;cursor:pointer;font-size:14px}
.wzp__opt:hover,.wzp__opt[aria-selected="true"]{background:var(--wzp-surface-2)}
@media (max-width:420px){.wzp__row{grid-template-columns:1fr}}
`.trim();
}

/**
 * Resolve the theme for a widget about to mount into `host`.
 *
 * 'auto' follows the PAGE, not the device. The widget is embedded in someone
 * else's checkout, so a shopper on a dark phone opening a merchant's white
 * storefront was getting a dark payment form inside a white card, which reads
 * as broken rather than as a preference being honoured.
 *
 * The device preference is still the fallback, for the case where no ancestor
 * paints an opaque background and there is genuinely nothing to match.
 */
export function resolveTheme(
  theme: PublicCheckoutConfig['theme'],
  host?: Element | null,
): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;

  const page = host ? hostLuminance(host) : null;
  if (page !== null) return page < 0.5 ? 'dark' : 'light';

  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Perceived lightness (0 to 1) of the nearest ancestor that actually paints a
 * background, or null when every one of them is transparent.
 */
function hostLuminance(host: Element): number | null {
  if (typeof window === 'undefined' || !window.getComputedStyle) return null;

  for (let el: Element | null = host; el; el = el.parentElement) {
    const rgb = parseRgb(window.getComputedStyle(el).backgroundColor);
    if (!rgb) continue;
    const [r, g, b] = rgb;
    // Rec. 601 luma: close enough to perceived brightness for a light/dark call.
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return null;
}

/** An opaque-enough rgb()/rgba() colour, or null for transparent and unparsable. */
function parseRgb(value: string): [number, number, number] | null {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i.exec(value ?? '');
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  if (!Number.isFinite(alpha) || alpha < 0.5) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

let injected = false;

/** Inject the stylesheet once per page, however many widgets mount. */
export function injectStyles(doc: Document = document): void {
  if (injected || doc.getElementById('wizpay-checkout-styles')) {
    injected = true;
    return;
  }
  const style = doc.createElement('style');
  style.id = 'wizpay-checkout-styles';
  style.textContent = widgetStyles();
  doc.head.appendChild(style);
  injected = true;
}

/** Reset the injected-styles flag. Testing only. */
export function __resetStyles(): void {
  injected = false;
}
