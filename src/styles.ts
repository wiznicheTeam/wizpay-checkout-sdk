import type { PublicCheckoutConfig } from './session';

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
.wzp{--wzp-radius:10px;--wzp-gap:14px;color:var(--wzp-text);font:400 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box}
.wzp *,.wzp *::before,.wzp *::after{box-sizing:inherit}
.wzp[data-theme="light"]{--wzp-text:#16191d;--wzp-muted:#5b6672;--wzp-line:#d9dee4;--wzp-surface:#fff;--wzp-surface-2:#f6f8fa;--wzp-danger:#b42318}
.wzp[data-theme="dark"]{--wzp-text:#e9edf2;--wzp-muted:#9aa6b2;--wzp-line:#2b3440;--wzp-surface:#141922;--wzp-surface-2:#1b2230;--wzp-danger:#f97066}
.wzp__head{display:flex;align-items:center;gap:10px;margin-bottom:var(--wzp-gap)}
.wzp__logo{max-height:28px;max-width:140px}
.wzp__name{font-weight:700}
.wzp__badge{margin-left:auto;padding:2px 8px;border-radius:999px;background:#fff3cd;color:#8a6100;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.wzp__field{margin-bottom:var(--wzp-gap)}
.wzp__label{display:block;margin-bottom:6px;font-size:13px;font-weight:600}
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
.wzp__error{margin-bottom:var(--wzp-gap);padding:10px 12px;border-radius:var(--wzp-radius);background:rgba(180,35,24,.1);color:var(--wzp-danger);font-size:14px}
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

/** Resolve the theme, honouring the shopper's own device preference on 'auto'. */
export function resolveTheme(theme: PublicCheckoutConfig['theme']): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
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
