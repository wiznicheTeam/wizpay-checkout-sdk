import { describe, expect, it } from 'vitest';
import { escapeHtml, formatBps, formatMoney } from '../src/format';

describe('formatMoney', () => {
  it.each([
    [1000, 'USD', '$10.00'],
    [12_360, 'USD', '$123.60'],
    [0, 'USD', '$0.00'],
    [7, 'USD', '$0.07'],
  ])('formats %i %s as %s', (minor, currency, expected) => {
    expect(formatMoney(minor, currency)).toBe(expected);
  });

  it('never blanks the total on an unknown currency or locale', () => {
    // A shopper seeing an empty total abandons the checkout.
    expect(formatMoney(1000, 'XYZ')).toContain('10.00');
    expect(formatMoney(1000, 'USD', 'not-a-locale')).toContain('10.00');
  });

  it('survives a non-finite amount', () => {
    expect(formatMoney(NaN, 'USD')).toBe('$0.00');
  });
});

describe('formatBps', () => {
  it.each([[1500, '15%'], [1750, '17.5%'], [0, '0%'], [10_000, '100%']])(
    'formats %i bps as %s',
    (bps, expected) => expect(formatBps(bps)).toBe(expected),
  );
});

describe('escapeHtml', () => {
  it('neutralises markup from server- or shopper-supplied text', () => {
    // Surcharge disclosure and branding come from merchant settings; a merchant
    // who pastes markup must not be able to script their own checkout page.
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeHtml(`"double" & 'single'`)).toBe('&quot;double&quot; &amp; &#39;single&#39;');
  });

  it('handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
