/**
 * Money formatting for display only.
 *
 * Every amount shown comes from the server already computed in minor units; the
 * widget never does arithmetic on money. That is deliberate — the only number
 * that matters is the one the server will charge, so the client's job is to
 * render it, not to derive it.
 */
export function formatMoney(minor: number, currency: string, locale = 'en-US'): string {
  const amount = (Number.isFinite(minor) ? minor : 0) / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    // An unknown currency or locale must not blank out the total.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** 1500 → "15%", 1750 → "17.5%" */
export function formatBps(bps: number): string {
  return `${Math.round(bps) / 100}%`;
}

/** Escape text before it goes anywhere near innerHTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
