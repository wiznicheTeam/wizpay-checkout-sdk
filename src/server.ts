import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpClient, WizPayError, type ClientOptions } from './client';
import { looksLikeSecretKey } from './environment';

export { WizPayError };

export interface CheckoutSessionInput {
  /** The WIZPay store to charge. */
  storeId: string;
  /** Amount in the currency's minor units (1000 = $10.00). Never a decimal. */
  amountMinor: number;
  /** Your own reference for this order. */
  merchantReference: string;
  currency?: string;
  /** 'payment' charges; 'setup' only saves a card for later. */
  mode?: 'payment' | 'setup';
  /** Your customer's id. Required for saved cards — it scopes them to one shopper. */
  customerRef?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
  /**
   * Order detail for interchange optimisation: `lineItems`, L2/L3
   * `enhancedSchemeData`, or `lodging` for hotels. Optional, but when given the
   * lines must reconcile to the amount charged — WIZPay appends tip and
   * surcharge lines for you.
   *
   * Accepted ONLY here, never from the browser: it affects your processing rate
   * and must not be something a shopper can alter.
   */
  enhancedData?: Record<string, unknown>;
}

export interface CheckoutSession {
  id: string;
  /** Hand this to your page with the id. Never log it; it authorises payment. */
  clientSecret: string;
  expiresAt: string;
  pricing: {
    subtotalMinor: number;
    tipMinor: number;
    surchargeMinor: number;
    totalMinor: number;
  };
}

export interface WizPayCheckoutOptions extends ClientOptions {
  secretKey: string;
}

/**
 * WIZPay Checkout — server SDK.
 *
 * Creating a session is the step that fixes the amount, which is why it needs a
 * SECRET key and must happen here rather than in the browser. Everything the
 * page then does is bounded by the session you created.
 */
export class WizPayCheckout {
  private readonly http: HttpClient;

  constructor(options: WizPayCheckoutOptions) {
    const { secretKey } = options;
    if (!secretKey) throw new Error('WIZPay: secretKey is required.');
    if (!looksLikeSecretKey(secretKey)) {
      throw new Error(
        'WIZPay: secretKey must be a secret key (wzp_test_… or wzp_live_…). A ' +
          'publishable key cannot create sessions — that is what stops a browser ' +
          'choosing its own price.',
      );
    }
    this.http = new HttpClient({ 'x-api-key': secretKey }, options);
  }

  readonly sessions = {
    /**
     * Create a checkout session. The amount is fixed here and is never accepted
     * from the browser again.
     *
     * Returns `clientSecret` exactly once — it is stored only as a hash, so it
     * cannot be retrieved later. Pass it to your page alongside `id`.
     */
    // `async` on purpose: validation failures must REJECT like every other
    // failure here. A method that sometimes throws synchronously and sometimes
    // rejects forces callers to write both try/catch and .catch(), and the one
    // they omit is the one that fires in production.
    create: async (input: CheckoutSessionInput): Promise<CheckoutSession> => {
      if (!Number.isInteger(input.amountMinor)) {
        throw new Error(
          `WIZPay: amountMinor must be an integer in minor units — ${input.amountMinor} looks like ` +
            'a decimal. $10.00 is 1000, not 10.',
        );
      }
      return this.http.post<CheckoutSession>('/v1/checkout/sessions', input);
    },
  };

  /**
   * Verify a webhook signature before trusting its body.
   *
   * Compare over the RAW request bytes, not a re-serialized object: re-encoding
   * JSON changes key order and whitespace, and the signature will never match.
   *
   * Constant-time comparison, so a wrong signature cannot be discovered one byte
   * at a time by timing the responses.
   */
  static verifyWebhook(rawBody: string | Buffer, signature: string, signingSecret: string): boolean {
    if (!signature || !signingSecret) return false;
    const expected = createHmac('sha256', signingSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature.trim());
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

export default WizPayCheckout;
