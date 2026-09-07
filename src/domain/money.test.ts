import { describe, expect, it } from 'vitest';
import { formatMinor, formatMinorRounded, parseToMinor, sumMinor } from './money';

/** Intl uses non-breaking spaces; tests care about the digits, not the byte. */
const norm = (value: string) => value.replace(/[  ]/g, ' ');

describe('formatMinor', () => {
  it('formats öre as Swedish kronor', () => {
    expect(norm(formatMinor(24950))).toBe('249,50 kr');
  });

  it('groups thousands', () => {
    expect(norm(formatMinor(123456789))).toBe('1 234 567,89 kr');
  });

  it('keeps trailing zeroes so prices line up', () => {
    expect(norm(formatMinor(25000))).toBe('250,00 kr');
  });

  it('handles zero and negatives', () => {
    expect(norm(formatMinor(0))).toBe('0,00 kr');
    expect(norm(formatMinor(-5050))).toContain('50,50');
  });
});

describe('formatMinorRounded', () => {
  it('drops decimals for headline figures', () => {
    expect(norm(formatMinorRounded(24950))).toBe('250 kr');
    expect(norm(formatMinorRounded(24949))).toBe('249 kr');
  });
});

describe('parseToMinor', () => {
  it('reads Swedish decimal commas', () => {
    expect(parseToMinor('249,50')).toBe(24950);
  });

  it('reads plain decimal points', () => {
    expect(parseToMinor('249.50')).toBe(24950);
  });

  it('reads whole numbers', () => {
    expect(parseToMinor('250')).toBe(25000);
  });

  it('strips spaces, non-breaking spaces and a trailing kr', () => {
    expect(parseToMinor('1 234,50 kr')).toBe(123450);
    expect(parseToMinor('1 234,50kr')).toBe(123450);
  });

  it('reads a lone comma as a decimal point, per Swedish convention', () => {
    // Swedish groups thousands with spaces, never commas, so "1,234" is
    // 1,234 kr — about 123 öre — not 1234 kr.
    expect(parseToMinor('1,234')).toBe(123);
  });

  it('handles mixed separators by trusting the last one', () => {
    expect(parseToMinor('1.234,50')).toBe(123450);
    expect(parseToMinor('1,234.50')).toBe(123450);
  });

  it('rounds to whole öre rather than storing a float', () => {
    expect(parseToMinor('0,015')).toBe(2);
    expect(Number.isInteger(parseToMinor('19,99') as number)).toBe(true);
  });

  it('rejects unreadable input instead of returning NaN', () => {
    expect(parseToMinor('')).toBeNull();
    expect(parseToMinor('   ')).toBeNull();
    expect(parseToMinor('abc')).toBeNull();
    expect(parseToMinor('12,34,56')).toBeNull();
    expect(parseToMinor('.')).toBeNull();
  });
});

describe('sumMinor', () => {
  it('sums without float drift', () => {
    expect(sumMinor([1010, 2020, 3030])).toBe(6060);
    expect(sumMinor([])).toBe(0);
  });
});
