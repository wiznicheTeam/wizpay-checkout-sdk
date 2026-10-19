/**
 * Test and live mode.
 *
 * WIZPay works like Stripe: ONE API serves both, and the key decides which.
 * `wzp_pk_test_…` sees test data and never moves real money; `wzp_pk_live_…`
 * does. There is no separate test host and no `mode` option to pass — switching
 * is swapping the key, in one place, which is the only version of this that
 * people get right.
 *
 * `apiBase` is a separate axis: it points the SDK at a WIZPay DEPLOYMENT (your
 * own develop environment, say). Most integrations never set it.
 */
export type KeyMode = 'test' | 'live';

/** Production WIZPay. Override via `apiBase` to target another deployment. */
export const DEFAULT_API_BASE = 'https://api.wizpay.ai';

const PUBLISHABLE = /^wzp_pk_(test|live)_[A-Za-z0-9_-]{43}$/;
const SECRET = /^wzp_(test|live)_/;

/** The mode a publishable key operates in, or null if it isn't one. */
export function keyMode(key: string): KeyMode | null {
  const match = typeof key === 'string' ? PUBLISHABLE.exec(key) : null;
  return match ? (match[1] as KeyMode) : null;
}

/** True when `key` is a well-formed publishable key. */
export function isPublishableKey(key: string): boolean {
  return keyMode(key) !== null;
}

/**
 * True when `key` looks like a SECRET key.
 *
 * Worth detecting explicitly rather than just rejecting as malformed: pasting a
 * secret key into browser code publishes it to every visitor, and the person who
 * did it needs to be told that, not "invalid key".
 */
export function looksLikeSecretKey(key: string): boolean {
  return typeof key === 'string' && SECRET.test(key) && !key.startsWith('wzp_pk_');
}

/**
 * Validate the key a page is mounting with, and return its mode.
 *
 * Throws on anything that isn't a publishable key, because every alternative is
 * worse: a silent failure leaves a blank space where the payment form should be,
 * and a leaked secret key needs to be loud.
 */
export function resolveMode(key: string): KeyMode {
  if (looksLikeSecretKey(key)) {
    throw new Error(
      'WIZPay: that is a SECRET key. It must never appear in browser code — anyone ' +
        'viewing the page can read it. Revoke it in your dashboard and use your ' +
        'publishable key (wzp_pk_…) here instead.',
    );
  }
  const mode = keyMode(key);
  if (!mode) {
    throw new Error(
      'WIZPay: publishableKey must look like wzp_pk_test_… or wzp_pk_live_… — ' +
        `received ${describe(key)}.`,
    );
  }
  return mode;
}

/** A safe description of a bad key for an error message — never the whole value. */
function describe(key: unknown): string {
  if (typeof key !== 'string') return String(key);
  if (key === '') return 'an empty string';
  return `"${key.slice(0, 11)}…"`;
}

/** Normalize an API base URL (no trailing slash). */
export function normalizeApiBase(base?: string): string {
  return (base ?? DEFAULT_API_BASE).replace(/\/+$/, '');
}
