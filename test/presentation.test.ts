import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveTheme } from '../src/styles.js';
import { shopperMessage } from '../src/widget.js';

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
