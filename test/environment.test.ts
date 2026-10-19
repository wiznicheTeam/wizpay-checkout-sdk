import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_BASE,
  isPublishableKey,
  keyMode,
  looksLikeSecretKey,
  normalizeApiBase,
  resolveMode,
} from '../src/environment';

const pk = (mode: 'test' | 'live') => `wzp_pk_${mode}_${'a'.repeat(43)}`;

describe('test vs live is decided by the key, not a flag', () => {
  it.each(['test', 'live'] as const)('reads %s mode off the key', (mode) => {
    expect(keyMode(pk(mode))).toBe(mode);
    expect(resolveMode(pk(mode))).toBe(mode);
    expect(isPublishableKey(pk(mode))).toBe(true);
  });

  it('uses the same API host for both — only the key changes', () => {
    // Going live must be a one-line key swap. If it also meant editing a host,
    // that is the step integrations forget, and they forget it in production.
    expect(normalizeApiBase()).toBe(DEFAULT_API_BASE);
    expect(normalizeApiBase(undefined)).toBe(DEFAULT_API_BASE);
  });

  it('allows pointing at another WIZPay deployment', () => {
    expect(normalizeApiBase('https://dev-api.wizpay.ai')).toBe('https://dev-api.wizpay.ai');
    expect(normalizeApiBase('https://dev-api.wizpay.ai/')).toBe('https://dev-api.wizpay.ai');
    expect(normalizeApiBase('https://dev-api.wizpay.ai///')).toBe('https://dev-api.wizpay.ai');
  });
});

describe('a secret key in browser code is called out explicitly', () => {
  it.each([`wzp_live_${'a'.repeat(43)}`, `wzp_test_${'a'.repeat(43)}`])(
    'detects %s as a secret key',
    (secret) => {
      expect(looksLikeSecretKey(secret)).toBe(true);
      expect(isPublishableKey(secret)).toBe(false);
    },
  );

  it('explains the consequence rather than saying "invalid key"', () => {
    // Someone who pastes a secret key into a page has published it to every
    // visitor. They need to know to revoke it, not just that it did not work.
    expect(() => resolveMode(`wzp_live_${'a'.repeat(43)}`)).toThrow(/SECRET key/);
    expect(() => resolveMode(`wzp_live_${'a'.repeat(43)}`)).toThrow(/revoke/i);
  });

  it('does not misread a publishable key as secret', () => {
    expect(looksLikeSecretKey(pk('live'))).toBe(false);
  });
});

describe('malformed keys fail loudly', () => {
  it.each([
    ['empty', ''],
    ['wrong prefix', 'pk_live_abc'],
    ['bad mode', `wzp_pk_prod_${'a'.repeat(43)}`],
    ['too short', 'wzp_pk_live_abc'],
    ['illegal characters', `wzp_pk_live_${'!'.repeat(43)}`],
  ])('rejects a %s key', (_label, key) => {
    expect(isPublishableKey(key)).toBe(false);
    expect(() => resolveMode(key)).toThrow(/wzp_pk_test_|wzp_pk_live_/);
  });

  it('never echoes the whole key back in an error', () => {
    // Errors reach consoles, logs and bug reports; truncate rather than reprint.
    const key = `wzp_pk_nope_${'z'.repeat(43)}`;
    try {
      resolveMode(key);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain('z'.repeat(43));
    }
  });

  it('does not throw on a non-string', () => {
    expect(keyMode(undefined as never)).toBeNull();
    expect(isPublishableKey(null as never)).toBe(false);
    expect(looksLikeSecretKey(42 as never)).toBe(false);
  });
});
