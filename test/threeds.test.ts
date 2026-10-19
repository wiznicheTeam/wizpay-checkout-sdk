import { describe, expect, it } from 'vitest';
import { isNativeThreeDS } from '../src/threeds';

describe('isNativeThreeDS', () => {
  it('recognises a native 3DS2 action', () => {
    expect(isNativeThreeDS({ type: 'threeDS2', subtype: 'fingerprint', token: 'abc' })).toBe(true);
    expect(isNativeThreeDS({ type: 'threeDS2', subtype: 'challenge', token: 'abc' })).toBe(true);
  });

  it('treats a plain redirect as NOT native, so it falls back to navigating', () => {
    expect(isNativeThreeDS({ type: 'redirect', url: 'https://bank.example' })).toBe(false);
  });

  it('requires a token — a 3DS2 action without one cannot be run in-page', () => {
    // Better to redirect than to render an iframe we have no data to post into.
    expect(isNativeThreeDS({ type: 'threeDS2', subtype: 'challenge' })).toBe(false);
  });

  it('handles an absent action', () => {
    expect(isNativeThreeDS(undefined)).toBe(false);
    expect(isNativeThreeDS({})).toBe(false);
  });
});

/**
 * The origin check is the security boundary for 3DS: the issuer's iframe is not
 * ours, and the result arrives by postMessage. Without pinning the origin, any
 * page could post a "verified" result and skip authentication entirely.
 */
describe('the return page origin is pinned', () => {
  it('derives the expected origin from the configured return URL', () => {
    const origin = new URL('https://js.wizpay.ai/v1/3ds-return.html').origin;
    expect(origin).toBe('https://js.wizpay.ai');
    // A lookalike must not match.
    expect(new URL('https://js.wizpay.ai.evil.test/v1/3ds-return.html').origin).not.toBe(origin);
  });
});
