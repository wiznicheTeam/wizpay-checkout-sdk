import { CheckoutWidget, type MountOptions } from './widget';

export { CheckoutWidget } from './widget';
export type { MountOptions } from './widget';
export { WizPayError } from './client';
export { isPublishableKey, keyMode, type KeyMode } from './environment';
export { formatMoney } from './format';
export type {
  ConfirmResult,
  Pricing,
  PublicCheckoutConfig,
  SavedMethod,
  SessionView,
} from './session';

/**
 * Render a WIZPay checkout into the page.
 *
 * Your SERVER creates the session (that is where the amount is fixed) and hands
 * the page its id and client secret. This renders it and confirms it. Nothing
 * here can change what is charged — which is why the publishable key is safe to
 * publish, and why this package can be open source.
 *
 * ```js
 * const checkout = await WizPayCheckout.mount({
 *   publishableKey: 'wzp_pk_live_…',
 *   sessionId, clientSecret,
 *   selector: '#wizpay-checkout',
 *   onSuccess: (payment) => { window.location = '/thank-you'; },
 * });
 * ```
 *
 * Resolves once the form is rendered and the secure card fields are ready.
 * Rejects if the key is wrong, the session cannot be loaded, or the page's
 * domain is not allow-listed — all of which are integration problems the
 * developer needs to see immediately rather than as a blank space.
 */
export async function mount(options: MountOptions): Promise<CheckoutWidget> {
  const widget = new CheckoutWidget(options);
  await widget.mount();
  return widget;
}

/** UMD/global surface for `<script src="https://js.wizpay.ai/v1/checkout.js">`. */
const WizPayCheckout = { mount, CheckoutWidget };

export default WizPayCheckout;

// Attach for plain <script> users, who have no import. Guarded so the module is
// still safe to import in Node (SSR, tests) where there is no window.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).WizPayCheckout = WizPayCheckout;
}
