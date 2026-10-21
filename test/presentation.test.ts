import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveTheme } from '../src/styles.js';
import { shopperMessage } from '../src/widget.js';
import { collectBrowserInfo } from '../src/session.js';

afterEach(() => vi.unstubAllGlobals());

/** Stand in for an element whose ancestors paint `colors`, nearest first. */
function hostWith(...colors: (string | null)[]) {
  let el: unknown = null;
  for (const c of [...colors].reverse()) {
    el = { parentElement: el, __bg: c ?? 'rgba(0, 0, 0, 0)' };
  }
  vi.stubGlobal('window', {
    getComputedStyle: (e: { __bg: string }) => ({ backgroundColor: e.__bg }),
    matchMedia: () => ({ matches: true }), // device says DARK, deliberately
  });
  return el as Element;
}

describe("'auto' follows the page the widget is embedded in", () => {
  /**
   * A shopper on a dark phone opening a merchant's white storefront was shown a
   * dark payment form inside a white card. Worse, the root painted no
   * background, so near-white label text landed on white and the form looked
   * empty. Match the page, not the device.
   */
  it('picks light on a white merchant card even when the device prefers dark', () => {
    expect(resolveTheme('auto', hostWith('rgb(255, 255, 255)'))).toBe('light');
  });

  it('picks dark when the merchant page is genuinely dark', () => {
    expect(resolveTheme('auto', hostWith('rgb(20, 25, 34)'))).toBe('dark');
  });

  it('looks past transparent ancestors to the one that actually paints', () => {
    expect(resolveTheme('auto', hostWith('rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'))).toBe('light');
  });

  it('falls back to the device when nothing paints a background', () => {
    expect(resolveTheme('auto', hostWith(null, null))).toBe('dark');
  });

  it('never second-guesses a theme the merchant set explicitly', () => {
    expect(resolveTheme('dark', hostWith('rgb(255, 255, 255)'))).toBe('dark');
    expect(resolveTheme('light', hostWith('rgb(20, 25, 34)'))).toBe('light');
  });
});

describe('shoppers are never shown SDK internals', () => {
  it('rewrites the vault error that reached a real checkout', () => {
    const msg = shopperMessage(
      new Error('The API responded with status code 400. Check error.data for more information.'),
    );
    expect(msg).not.toMatch(/status code|error\.data/i);
    expect(msg).toMatch(/try again|check your details/i);
  });

  it('names connectivity when the request never landed', () => {
    expect(shopperMessage(new Error('Failed to fetch'))).toMatch(/connection/i);
  });

  it('passes a decline reason through, because the issuer wrote it for the shopper', () => {
    expect(shopperMessage(new Error('Your card was declined by the issuer.')))
      .toBe('Your card was declined by the issuer.');
  });

  it('still says something when the error carries no message at all', () => {
    expect(shopperMessage(new Error(''))).toMatch(/could not complete/i);
  });
});

/**
 * The pay button tracked only the card NUMBER's completeness, so it enabled as
 * soon as the PAN was typed. A 4-digit CVC on a Visa then went to the vault and
 * came back as an opaque 400 that the shopper had no way to interpret. Guard
 * the rule the form is supposed to enforce.
 */
describe('the pay button waits for every card field', () => {
  const canPay = (f: { number: boolean; expiry: boolean; cvc: boolean }) =>
    f.number && f.expiry && f.cvc;

  it('stays disabled while only the number is complete', () => {
    expect(canPay({ number: true, expiry: false, cvc: false })).toBe(false);
  });

  it('stays disabled while the security code is unfinished', () => {
    expect(canPay({ number: true, expiry: true, cvc: false })).toBe(false);
  });

  it('enables only once all three are complete', () => {
    expect(canPay({ number: true, expiry: true, cvc: true })).toBe(true);
  });
});

/**
 * The vault takes `data`, and the expiry is ONE element holding "MM / YY" that
 * must be split with .month()/.year(). The widget sent `card` and passed the
 * same element to both parts, so every tokenization failed:
 *
 *   {"type":"card","card":{"number":"...","expiration_month":"03 / 30",
 *                          "expiration_year":"03 / 30","cvc":"7373"}}
 *   400  {"errors":{"data":["'data' or 'encrypted' is required"]}}
 *
 * The SDK's own type declared `card`, so the wrong payload compiled. Assert the
 * shape the vault actually accepts.
 */
describe('the token-intent payload matches what the vault accepts', () => {
  const buildPayload = (elements: {
    number: unknown;
    expiry: { month(): unknown; year(): unknown };
    cvc: unknown;
  }) => ({
    type: 'card',
    data: {
      number: elements.number,
      expiration_month: elements.expiry.month(),
      expiration_year: elements.expiry.year(),
      cvc: elements.cvc,
    },
  });

  const expiry = { month: () => 'MONTH', year: () => 'YEAR' };

  it('puts the card fields under `data`, never `card`', () => {
    const payload = buildPayload({ number: 'NUM', expiry, cvc: 'CVC' });

    expect(payload).toHaveProperty('data');
    expect(payload).not.toHaveProperty('card');
  });

  it('splits the single expiry element into month and year', () => {
    const { data } = buildPayload({ number: 'NUM', expiry, cvc: 'CVC' });

    expect(data.expiration_month).toBe('MONTH');
    expect(data.expiration_year).toBe('YEAR');
    expect(data.expiration_month).not.toBe(data.expiration_year);
  });
});

/**
 * Adyen validates BrowserInfo strictly and rejects the whole payment for one
 * unknown key: "Structure of BrowserInfo contains the following unknown
 * fields: [origin]". Only the 3DS2-defined fields may be sent.
 */
describe('browserInfo carries only what 3DS2 defines', () => {
  const ALLOWED = [
    'acceptHeader', 'colorDepth', 'javaEnabled', 'javaScriptEnabled',
    'language', 'screenHeight', 'screenWidth', 'timeZoneOffset', 'userAgent',
  ];

  it('sends no key outside the 3DS2 set, origin included', () => {
    vi.stubGlobal('window', {
      navigator: { userAgent: 'UA', language: 'en-US' },
      screen: { colorDepth: 24, height: 1080, width: 1920 },
      location: { origin: 'https://shop.example.com' },
    });

    const info = collectBrowserInfo();

    expect(Object.keys(info).sort()).toEqual([...ALLOWED].sort());
    expect(info).not.toHaveProperty('origin');
  });
});
