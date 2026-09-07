/**
 * Money is stored as integer minor units (öre) throughout. Floats are never
 * used for amounts — 0.1 + 0.2 problems in a budget app are not acceptable.
 */

const SEK = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  minimumFractionDigits: 2,
});

const SEK_ROUNDED = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `24950` -> `"249,50 kr"` */
export function formatMinor(amountMinor: number): string {
  return SEK.format(amountMinor / 100);
}

/**
 * `24950` -> `"250 kr"`. For chart axes and headline totals, where two decimals
 * are noise.
 */
export function formatMinorRounded(amountMinor: number): string {
  return SEK_ROUNDED.format(Math.round(amountMinor / 100));
}

/**
 * Parses user input into öre. Accepts Swedish (`1 234,50`) and plain
 * (`1234.50`) forms, along with a stray `kr`. Returns null on anything it
 * cannot read, so callers can show a validation error rather than store a NaN.
 */
export function parseToMinor(input: string): number | null {
  const cleaned = input
    .replace(/\s| | /g, '')
    .replace(/kr$/i, '')
    .trim();
  if (cleaned === '') return null;

  // Treat whichever separator appears last as the decimal point.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalised = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalised = cleaned.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    // In Swedish the comma is always the decimal separator; thousands are
    // grouped with spaces, which are stripped above. So a lone comma is never
    // a grouping character — "1,234" is 1.234 kr, not 1234 kr.
    normalised = cleaned.replace(',', '.');
  }

  if (!/^-?\d*\.?\d*$/.test(normalised) || normalised === '.') return null;

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;

  return Math.round(value * 100);
}

export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
