import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { WizPayCheckout } from '../src/server';

const SECRET = `wzp_test_${'a'.repeat(43)}`;
const ok = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body) });

const client = (fetchImpl: ReturnType<typeof vi.fn>) =>
  new WizPayCheckout({ secretKey: SECRET, fetchImpl: fetchImpl as never, apiBase: 'https://api.test' });

describe('the secret key stays on the server', () => {
  it('rejects a publishable key with the reason it matters', () => {
    expect(() => new WizPayCheckout({ secretKey: `wzp_pk_live_${'a'.repeat(43)}` })).toThrow(
      /publishable key cannot create sessions/,
    );
  });

  it('requires a key at all', () => {
    expect(() => new WizPayCheckout({ secretKey: '' })).toThrow(/required/);
  });

  it('sends the secret key as x-api-key, never in the body', async () => {
    const f = ok({ id: 's1', clientSecret: 'cs_x' });
    await client(f).sessions.create({ storeId: 'store-1', amountMinor: 1000, merchantReference: 'ORD-1' });

    const [, init] = f.mock.calls[0];
    expect(init.headers['x-api-key']).toBe(SECRET);
    expect(init.body).not.toContain(SECRET);
  });
});

describe('creating a session', () => {
  it('posts to the checkout sessions endpoint with the order', async () => {
    const f = ok({ id: 's1', clientSecret: 'cs_x', expiresAt: 'later' });
    const session = await client(f).sessions.create({
      storeId: 'store-1', amountMinor: 12_360, merchantReference: 'ORD-1', customerRef: 'cust-9',
    });

    expect(f.mock.calls[0][0]).toBe('https://api.test/v1/checkout/sessions');
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({
      storeId: 'store-1', amountMinor: 12_360, customerRef: 'cust-9',
    });
    expect(session.clientSecret).toBe('cs_x');
  });

  it('catches a decimal amount before it reaches the API', async () => {
    // $10.00 sent as 10.00 would charge 10 cents. Worth refusing locally, with
    // the correction spelled out.
    await expect(
      client(ok({})).sessions.create({ storeId: 's', amountMinor: 10.5, merchantReference: 'R' }),
    ).rejects.toThrow(/1000, not 10/);
  });

  it('surfaces an API error message rather than a bare status', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false, status: 403, text: async () => JSON.stringify({ message: 'Checkout is not enabled for this store' }),
    });
    await expect(
      client(f as never).sessions.create({ storeId: 's', amountMinor: 100, merchantReference: 'R' }),
    ).rejects.toThrow(/not enabled for this store/);
  });

  it('explains a non-JSON response instead of throwing a parse error', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => '<html>gateway</html>' });
    await expect(
      client(f as never).sessions.create({ storeId: 's', amountMinor: 100, merchantReference: 'R' }),
    ).rejects.toThrow(/non-JSON response.*apiBase/s);
  });
});

describe('webhook verification', () => {
  const body = JSON.stringify({ type: 'checkout.completed', data: { total_minor: 12_360 } });
  // GOLDEN VECTOR, produced by the WIZPay API's own signer
  // (src/developer/webhook-secret.util.ts). Hard-coding the server's real output
  // is the point: an earlier version of this suite defined its own sign() that
  // mirrored the implementation, so the tests passed while every genuine
  // delivery was rejected. A test that only agrees with the code it tests
  // proves nothing about the wire.
  const secret = 'whsec_golden_vector_fixture';
  const golden = {
    body: '{"type":"checkout.completed","data":{"total_minor":12360}}',
    t: 1761004800,
    v1: '8a78e91b8ed12949c89fbb27fea0d0afba180bba49a8ee5dddaf6dfcaf6b7584',
  };
  const header = (t: number, v1: string) => `t=${t},v1=${v1}`;
  // The vector is fixed in the past, so freshness has to be off to check it.
  const NO_TTL = 0;

  it('accepts the signature the WIZPay API actually produces', () => {
    expect(
      WizPayCheckout.verifyWebhook(golden.body, header(golden.t, golden.v1), secret, NO_TTL),
    ).toBe(true);
  });

  it('signs over `t.body`, not the body alone', () => {
    // The old, broken scheme. If this ever passes again, the regression is back.
    const bodyOnly = createHmac('sha256', secret).update(golden.body).digest('hex');
    expect(WizPayCheckout.verifyWebhook(golden.body, bodyOnly, secret, NO_TTL)).toBe(false);
    expect(
      WizPayCheckout.verifyWebhook(golden.body, header(golden.t, bodyOnly), secret, NO_TTL),
    ).toBe(false);
  });

  // Everything below signs the way the server does, verified against the vector above.
  const sign = (t: number, body: string, sec = secret) =>
    createHmac('sha256', sec).update(`${t}.${body}`).digest('hex');
  const fresh = (body: string, sec = secret) => {
    const t = Math.floor(Date.now() / 1000);
    return header(t, sign(t, body, sec));
  };

  it('rejects a tampered body', () => {
    const tampered = golden.body.replace('12360', '1');
    expect(WizPayCheckout.verifyWebhook(tampered, fresh(golden.body), secret)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(
      WizPayCheckout.verifyWebhook(golden.body, fresh(golden.body, 'whsec_other'), secret),
    ).toBe(false);
  });

  it('rejects a replayed delivery outside the freshness window', () => {
    const old = Math.floor(Date.now() / 1000) - 600;
    expect(
      WizPayCheckout.verifyWebhook(golden.body, header(old, sign(old, golden.body)), secret),
    ).toBe(false);
  });

  it('accepts a delivery inside the freshness window', () => {
    const recent = Math.floor(Date.now() / 1000) - 60;
    expect(
      WizPayCheckout.verifyWebhook(golden.body, header(recent, sign(recent, golden.body)), secret),
    ).toBe(true);
  });

  it('rejects a fresh timestamp pasted onto an old signature', () => {
    // Because t is inside the signed material, restamping cannot revive a replay.
    const old = Math.floor(Date.now() / 1000) - 600;
    const now = Math.floor(Date.now() / 1000);
    expect(
      WizPayCheckout.verifyWebhook(golden.body, header(now, sign(old, golden.body)), secret),
    ).toBe(false);
  });

  it.each([
    ['a malformed header', 'nonsense'],
    ['a header with no v1', 't=1761004800'],
    ['a header with no t', 'v1=deadbeef'],
    ['a non-numeric t', 't=abc,v1=deadbeef'],
    ['an empty header', ''],
  ])('rejects %s', (_label, sig) => {
    expect(WizPayCheckout.verifyWebhook(golden.body, sig, secret)).toBe(false);
  });

  it('rejects an empty secret', () => {
    expect(WizPayCheckout.verifyWebhook(golden.body, fresh(golden.body), '')).toBe(false);
  });

  it('verifies raw bytes, so a re-serialized object does not match', () => {
    // Re-encoding JSON reorders keys and drops whitespace; verifying the parsed
    // object instead of the raw bytes is the classic reason webhooks "randomly" fail.
    const sig = fresh(golden.body);
    expect(WizPayCheckout.verifyWebhook(Buffer.from(golden.body), sig, secret)).toBe(true);
    expect(WizPayCheckout.verifyWebhook(golden.body + ' ', sig, secret)).toBe(false);
  });
});
