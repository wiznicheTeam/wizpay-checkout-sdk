import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/client.js';

afterEach(() => vi.unstubAllGlobals());

/**
 * Browsers enforce the RECEIVER of fetch: calling it with anything but the
 * window throws "Failed to execute 'fetch' on 'Window': Illegal invocation".
 * Storing bare `fetch` on an instance and invoking it as `this.doFetch(...)`
 * does exactly that, so the widget failed to mount on every page.
 *
 * Node's fetch ignores its receiver, which is why the entire suite passed while
 * the browser bundle was unusable. These tests reproduce the browser rule so
 * Node can no longer hide it.
 */
describe('fetch is called with the right receiver', () => {
  it('does not pass the client as fetch\'s receiver', async () => {
    const strict = function (this: unknown, _url: string, _init?: unknown) {
      // Stand in for the browser's own check.
      if (this !== globalThis && this !== undefined) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => "{\"ok\":true}" } as Response);
    };
    vi.stubGlobal('fetch', strict);

    const client = new HttpClient({ 'x-api-key': 'k' }, { apiBase: 'https://api.test' });

    await expect(client.post('/v1/checkout/sessions', { a: 1 })).resolves.toEqual({ ok: true });
  });

  it('still honours an injected fetch implementation', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{\"ok\":true}" } as Response);
    const client = new HttpClient({}, { apiBase: 'https://api.test', fetchImpl: spy as unknown as typeof fetch });

    await client.get('/v1/ping');

    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toBe('https://api.test/v1/ping');
  });
});
