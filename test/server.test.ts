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
  const secret = 'whsec_test';
  const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

  it('accepts a correctly signed body', () => {
    expect(WizPayCheckout.verifyWebhook(body, sign(body), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = body.replace('12360', '1');
    expect(WizPayCheckout.verifyWebhook(tampered, sign(body), secret)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const other = createHmac('sha256', 'whsec_other').update(body).digest('hex');
    expect(WizPayCheckout.verifyWebhook(body, other, secret)).toBe(false);
  });

  it.each([['empty signature', ''], ['empty secret', undefined]])('rejects on %s', (label) => {
    const sig = label === 'empty signature' ? '' : sign(body);
    const sec = label === 'empty secret' ? '' : secret;
    expect(WizPayCheckout.verifyWebhook(body, sig, sec)).toBe(false);
  });

  it('verifies raw bytes, so a re-serialized object does not match', () => {
    // Re-encoding JSON reorders keys and drops whitespace; verifying the parsed
    // object instead of the raw bytes is the classic reason webhooks "randomly" fail.
    const reserialized = JSON.stringify(JSON.parse(body.replace('{"type"', '{ "type"')));
    expect(WizPayCheckout.verifyWebhook(Buffer.from(body), sign(body), secret)).toBe(true);
    expect(WizPayCheckout.verifyWebhook(reserialized + ' ', sign(body), secret)).toBe(false);
  });
});
