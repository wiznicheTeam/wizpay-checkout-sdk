import { HttpClient, type ClientOptions } from './client.js';

/** Public checkout config for a store (no rates, no secrets). */
export interface PublicCheckoutConfig {
  storeId: string;
  methods: string[];
  tips: { enabled: boolean; presetBps: number[]; allowCustom: boolean; defaultIndex: number | null };
  surchargeDisclosure: string | null;
  termsUrl: string | null;
  theme: 'light' | 'dark' | 'auto';
  locale: string;
  branding: { displayName: string; brandColor: string; accentColor: string; logoUrl: string | null };
  basisTheoryPublicKey: string | null;
}

export interface Pricing {
  subtotalMinor: number;
  tipMinor: number;
  surchargeMinor: number;
  totalMinor: number;
  surchargeSuppressedReason?: 'debit' | 'prepaid' | 'disabled';
}

export interface SessionView {
  id: string;
  status: string;
  mode: string;
  currency: string;
  amountMinor: number;
  methods: string[];
  tips: PublicCheckoutConfig['tips'];
  surchargeDisclosure: string | null;
  expiresAt: string;
  pricing: Pricing;
}

export interface SavedMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  label: string | null;
  isDefault: boolean;
}

export interface ConfirmResult {
  sessionId: string;
  status: 'succeeded' | 'requires_action' | 'failed';
  paymentId?: string;
  action?: Record<string, unknown>;
  failureReason?: string;
  amountCharged?: number;
  pricing: Pricing;
}

export interface TipChoice {
  presetIndex?: number;
  customMinor?: number;
}

/**
 * The browser's view of the checkout API, authenticated by the publishable key.
 *
 * Note what is NOT here: nothing creates a session or names an amount. The
 * browser can price, read and confirm the session it was given, and that is the
 * whole surface — which is why the key being public is safe.
 */
export class CheckoutSessionClient {
  private readonly http: HttpClient;

  constructor(
    publishableKey: string,
    private readonly sessionId: string,
    private readonly clientSecret: string,
    options: ClientOptions = {},
  ) {
    this.http = new HttpClient({ 'x-publishable-key': publishableKey }, options);
  }

  config(storeId: string): Promise<PublicCheckoutConfig> {
    return this.http.post<PublicCheckoutConfig>('/v1/checkout/config', { storeId });
  }

  /** POST, not GET: the client secret belongs in a body, never in a URL where it
   *  would reach access logs, browser history and Referer headers. */
  load(): Promise<SessionView> {
    return this.http.post<SessionView>(`/v1/checkout/sessions/${this.sessionId}`, {
      clientSecret: this.clientSecret,
    });
  }

  /** Re-price on a method, tip or card change. The SERVER decides the numbers. */
  quote(input: { method?: string; funding?: string; tip?: TipChoice }): Promise<Pricing> {
    return this.http.post<Pricing>(`/v1/checkout/sessions/${this.sessionId}/quote`, {
      clientSecret: this.clientSecret,
      ...input,
    });
  }

  savedMethods(): Promise<{ paymentMethods: SavedMethod[] }> {
    return this.http.post<{ paymentMethods: SavedMethod[] }>(
      `/v1/checkout/sessions/${this.sessionId}/payment-methods`,
      { clientSecret: this.clientSecret },
    );
  }

  forgetMethod(methodId: string): Promise<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(
      `/v1/checkout/sessions/${this.sessionId}/payment-methods/${methodId}`,
      { clientSecret: this.clientSecret },
    );
  }

  /** Note there is no amount: the server prices from the session it created. */
  confirm(input: {
    method?: string;
    tip?: TipChoice;
    tokenIntentId?: string;
    savedMethodId?: string;
    saveCard?: boolean;
    holderName?: string;
    email?: string;
    billingAddress: Record<string, unknown>;
    browserInfo?: Record<string, unknown>;
  }): Promise<ConfirmResult> {
    return this.http.post<ConfirmResult>(`/v1/checkout/sessions/${this.sessionId}/confirm`, {
      clientSecret: this.clientSecret,
      ...input,
    });
  }

  /**
   * Hand the issuer's 3D Secure result back so the payment can resolve.
   *
   * Does not re-consume the session: confirm already did, and the shopper is
   * legitimately mid-authentication. The details payload comes from the issuer
   * and is meaningless without the original payment.
   */
  details(details: Record<string, unknown>): Promise<ConfirmResult> {
    return this.http.post<ConfirmResult>(`/v1/checkout/sessions/${this.sessionId}/details`, {
      clientSecret: this.clientSecret,
      details,
    });
  }

  autocompleteAddress(input: string, sessionToken?: string, country?: string) {
    return this.http.post<{ suggestions: Array<{ placeId: string; text: string }> }>(
      '/v1/checkout/places/autocomplete',
      { input, sessionToken, country },
    );
  }

  addressDetails(placeId: string, sessionToken?: string) {
    return this.http.post<{ address: Record<string, string> }>('/v1/checkout/places/details', {
      placeId,
      sessionToken,
    });
  }
}

/**
 * Browser data 3DS risk engines expect. Missing fields measurably increase the
 * rate at which issuers challenge rather than approve, so it is collected even
 * though nothing in our own flow reads it.
 */
export function collectBrowserInfo(): Record<string, unknown> {
  const { navigator: nav, screen } = window;
  return {
    acceptHeader: '*/*',
    userAgent: nav.userAgent,
    language: nav.language,
    colorDepth: screen.colorDepth,
    screenHeight: screen.height,
    screenWidth: screen.width,
    timeZoneOffset: new Date().getTimezoneOffset(),
    javaEnabled: false,
    // Adyen validates BrowserInfo strictly and rejects the whole payment for an
    // unknown key: "Structure of BrowserInfo contains the following unknown
    // fields: [origin]". Only the 3DS2-defined fields belong here. The origin is
    // already enforced server-side from the real Origin header, which a page
    // cannot forge, so sending it was never doing any work.
    javaScriptEnabled: true,
  };
}
