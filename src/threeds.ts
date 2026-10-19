/**
 * Native (in-page) 3D Secure 2.
 *
 * The issuer's authentication runs in an iframe on the merchant's page rather
 * than by redirecting away. That matters commercially: a redirect to the bank
 * loses a meaningful share of shoppers, who either abandon or never come back
 * from the issuer's page.
 *
 * Two steps, and only the second is ever visible:
 *
 *  1. **Fingerprint** — a hidden iframe posts device data to the issuer so it can
 *     decide whether a challenge is needed at all. Most payments stop here, and
 *     the shopper sees nothing.
 *  2. **Challenge** — a visible iframe where the shopper confirms (a code, an app
 *     prompt). Only reached when the issuer asks for it.
 *
 * Both steps end with the issuer POSTing to a notification URL we control, which
 * `postMessage`s the result back to this window. That page is served from the
 * SDK's own CDN origin, and every message is checked against it — an iframe we
 * do not control is posting into this page, so the origin check is the boundary.
 */
export interface ThreeDSAction {
  type?: string;
  subtype?: string;
  token?: string;
  authorisationToken?: string;
  paymentData?: string;
  url?: string;
}

export interface ThreeDSResult {
  /** The `details` payload to hand back to the API. */
  details: Record<string, unknown>;
}

/** Where the issuer posts its result. Must be an origin we control. */
export interface ThreeDSOptions {
  /** e.g. https://js.wizpay.ai/v1/3ds-return.html */
  returnPageUrl: string;
  /** Where the visible challenge renders. */
  container: HTMLElement;
  /** Give up on the invisible step rather than hanging the checkout. */
  fingerprintTimeoutMs?: number;
}

const FINGERPRINT_TIMEOUT_MS = 10_000;

/** True when this action is native 3DS2 rather than a plain redirect. */
export function isNativeThreeDS(action: ThreeDSAction | undefined): boolean {
  return action?.type === 'threeDS2' && Boolean(action.token);
}

/**
 * Run the 3DS2 step the issuer asked for and resolve with the details to submit.
 *
 * Never rejects on a timeout: an issuer that does not answer the invisible step
 * is explicitly allowed by the spec, and the right move is to tell the provider
 * so ("N" — not completed) and let it decide, not to fail the shopper's payment.
 */
export async function runThreeDS(action: ThreeDSAction, options: ThreeDSOptions): Promise<ThreeDSResult> {
  const token = decodeToken(action.token);
  const isChallenge = action.subtype === 'challenge';

  if (isChallenge) {
    const transStatus = await challenge(action, token, options);
    return {
      details: {
        'threeds2.challengeResult': encode({
          transStatus,
          authorisationToken: action.authorisationToken,
        }),
      },
    };
  }

  const threeDSCompInd = await fingerprint(action, token, options);
  return {
    details: {
      'threeds2.fingerprint': encode({
        threeDSCompInd,
        authorisationToken: action.authorisationToken,
      }),
    },
  };
}

/** Step 1: invisible. Resolves 'Y' when the issuer answered, 'N' otherwise. */
async function fingerprint(
  action: ThreeDSAction,
  token: Record<string, unknown>,
  options: ThreeDSOptions,
): Promise<string> {
  const url = String(token.threeDSMethodURL ?? '');
  // No method URL means the issuer does not support the invisible step. That is
  // normal, not an error: report "not completed" and carry on.
  if (!url) return 'U';

  const frame = hiddenFrame();
  options.container.appendChild(frame);

  const notification = String(token.threeDSServerTransID ?? '');
  const data = encode({
    threeDSServerTransID: notification,
    threeDSMethodNotificationURL: options.returnPageUrl,
  });

  const result = await Promise.race([
    waitForMessage(options.returnPageUrl, 'fingerprint'),
    delay(options.fingerprintTimeoutMs ?? FINGERPRINT_TIMEOUT_MS).then(() => null),
  ]).finally(() => frame.remove());

  postForm(frame, url, { threeDSMethodData: data });
  return result === null ? 'N' : 'Y';
}

/** Step 2: visible. Resolves with the issuer's transStatus. */
async function challenge(
  action: ThreeDSAction,
  token: Record<string, unknown>,
  options: ThreeDSOptions,
): Promise<string> {
  const url = String(token.acsURL ?? '');
  if (!url) throw new Error('WIZPay: the bank asked to verify this payment but gave no verification address.');

  const frame = visibleFrame();
  options.container.appendChild(frame);

  const creq = encode({
    threeDSServerTransID: token.threeDSServerTransID,
    acsTransID: token.acsTransID,
    messageVersion: token.messageVersion ?? '2.2.0',
    messageType: 'CReq',
    // 05 = full screen on mobile. The challenge is the step shoppers abandon;
    // cramming it into a small box makes that worse.
    challengeWindowSize: '05',
  });

  const waiting = waitForMessage(options.returnPageUrl, 'challenge');
  postForm(frame, url, { creq });

  try {
    const payload = await waiting;
    return String((payload as { transStatus?: unknown })?.transStatus ?? 'N');
  } finally {
    frame.remove();
  }
}

/**
 * Listen for the result our return page posts back.
 *
 * The origin check is the security boundary here: the issuer's iframe is not
 * ours, and without it any page could post a "verified" result into this window
 * and skip authentication entirely.
 */
function waitForMessage(returnPageUrl: string, kind: string): Promise<unknown> {
  const expected = new URL(returnPageUrl, window.location.href).origin;

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== expected) return;
      const data = parse(event.data);
      if (!data || data.source !== 'wizpay-3ds') return;
      if (data.kind && data.kind !== kind) return;
      window.removeEventListener('message', handler);
      resolve(data.payload ?? data);
    };
    window.addEventListener('message', handler);
  });
}

/** POST into an iframe — how the 3DS protocol hands data to the issuer. */
function postForm(frame: HTMLIFrameElement, action: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = frame.name;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function hiddenFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.name = `wzp-3ds-fp-${Date.now()}`;
  frame.width = '0';
  frame.height = '0';
  frame.style.cssText = 'display:none;border:0';
  return frame;
}

function visibleFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.name = `wzp-3ds-ch-${Date.now()}`;
  // Sized for the 05 (full-screen) challenge window, and allowed to grow.
  frame.style.cssText = 'width:100%;min-height:420px;border:0;display:block';
  frame.setAttribute('title', 'Verify your payment with your bank');
  return frame;
}

function decodeToken(token: string | undefined): Record<string, unknown> {
  if (!token) return {};
  try {
    return JSON.parse(atob(token)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parse(data: unknown): { source?: string; kind?: string; payload?: unknown } | null {
  if (typeof data === 'object' && data) return data as { source?: string; kind?: string };
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as { source?: string; kind?: string };
  } catch {
    return null;
  }
}

/** base64 of a JSON object, as the 3DS protocol expects. */
function encode(value: unknown): string {
  return btoa(JSON.stringify(value));
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
