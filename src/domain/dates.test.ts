import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  addMonthsIso,
  isValidMonthKey,
  nextOccurrence,
  monthKey,
  monthsInRange,
  startOfWeekIso,
  todayIso,
  weekDates,
} from './dates';

describe('monthKey', () => {
  it('extracts the shard from a plain date', () => {
    expect(monthKey('2026-09-14')).toBe('2026-09');
  });

  it('extracts the shard from an ISO datetime', () => {
    expect(monthKey('2026-09-14T18:30:00Z')).toBe('2026-09');
  });

  it('does not shift across timezones at month edges', () => {
    // Parsing this into a Date in a negative-offset zone would yield August.
    expect(monthKey('2026-09-01T00:30:00Z')).toBe('2026-09');
  });

  it('throws on unusable input rather than writing to a bad shard', () => {
    expect(() => monthKey('not-a-date')).toThrow();
  });
});

describe('isValidMonthKey', () => {
  it('accepts well-formed keys', () => {
    expect(isValidMonthKey('2026-01')).toBe(true);
    expect(isValidMonthKey('2026-12')).toBe(true);
  });

  it('rejects malformed or impossible keys', () => {
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-00')).toBe(false);
    expect(isValidMonthKey('2026-1')).toBe(false);
    expect(isValidMonthKey('../secrets')).toBe(false);
  });
});

describe('monthsInRange', () => {
  it('returns a single month for a range inside one', () => {
    expect(monthsInRange('2026-09-01', '2026-09-30')).toEqual(['2026-09']);
  });

  it('spans a month boundary', () => {
    expect(monthsInRange('2026-09-28', '2026-10-04')).toEqual(['2026-09', '2026-10']);
  });

  it('spans a year boundary', () => {
    expect(monthsInRange('2026-12-28', '2027-01-03')).toEqual(['2026-12', '2027-01']);
  });

  it('returns nothing for an inverted range', () => {
    expect(monthsInRange('2026-10-01', '2026-09-01')).toEqual([]);
  });
});

describe('week helpers', () => {
  it('starts weeks on Monday', () => {
    // 2026-09-14 is a Monday; 2026-09-20 the Sunday that ends that week.
    expect(startOfWeekIso('2026-09-14')).toBe('2026-09-14');
    expect(startOfWeekIso('2026-09-20')).toBe('2026-09-14');
    expect(startOfWeekIso('2026-09-17')).toBe('2026-09-14');
  });

  it('produces seven consecutive dates', () => {
    expect(weekDates('2026-09-17')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
  });

  it('crosses month boundaries when adding days', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('formats a local date without UTC drift', () => {
    expect(todayIso(new Date(2026, 8, 14))).toBe('2026-09-14');
  });
});

describe('recurrence', () => {
  it('advances by day, week and month', () => {
    expect(nextOccurrence('2026-09-14', 'daily')).toBe('2026-09-15');
    expect(nextOccurrence('2026-09-14', 'weekly')).toBe('2026-09-21');
    expect(nextOccurrence('2026-09-14', 'monthly')).toBe('2026-10-14');
  });

  it('clamps a month step to the last valid day', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('crosses a year boundary', () => {
    expect(addMonthsIso('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('returns nothing for a one-off', () => {
    expect(nextOccurrence('2026-09-14', 'none')).toBeNull();
    expect(nextOccurrence('2026-09-14', undefined)).toBeNull();
  });
});
