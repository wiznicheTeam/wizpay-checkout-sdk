import { normalizeApiBase } from './environment.js';

/** An error returned by the WIZPay API. */
export class WizPayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'WizPayError';
  }
}

export interface ClientOptions {
  /** WIZPay deployment to talk to. Defaults to production. */
  apiBase?: string;
  /** Override for tests and non-browser environments. */
  fetchImpl?: typeof fetch;
}

/**
 * Minimal JSON client shared by the browser widget and the server SDK.
 *
 * Deliberately tiny and dependency-free: this ships inside a public bundle that
 * merchants load on their checkout pages, so every kilobyte and every transitive
 * dependency is a cost paid by their customers — and a supply-chain risk on a
 * page that handles payments.
 */
export class HttpClient {
  private readonly base: string;
  private readonly doFetch: typeof fetch;

  constructor(
    private readonly headers: Record<string, string>,
    options: ClientOptions = {},
  ) {
    this.base = normalizeApiBase(options.apiBase);
    const impl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    if (!impl) {
      throw new Error('WIZPay: no fetch implementation available. On Node, use 18 or newer.');
    }
    this.doFetch = impl;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.doFetch(`${this.base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // A non-JSON body from a payments API means something in front of it
      // answered — a proxy, a WAF, an error page. Say so rather than throwing
      // an opaque parse error.
      throw new WizPayError(
        `WIZPay returned a non-JSON response (HTTP ${res.status}). Check that apiBase points at a WIZPay API.`,
        res.status,
      );
    }

    if (!res.ok) {
      const payload = parsed as { message?: unknown; error?: unknown; code?: unknown };
      const message =
        (typeof payload.message === 'string' && payload.message) ||
        (typeof payload.error === 'string' && payload.error) ||
        `WIZPay request failed (HTTP ${res.status})`;
      throw new WizPayError(message, res.status, typeof payload.code === 'string' ? payload.code : undefined);
    }

    return parsed as T;
  }
}
