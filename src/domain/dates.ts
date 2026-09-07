/**
 * Month bucketing for the sharded collections. Kept dependency-free and
 * timezone-agnostic: all stored dates are plain `YYYY-MM-DD` or ISO datetimes,
 * and the shard is derived from the leading characters rather than by parsing
 * into a Date, which would shift the day across timezones.
 */

const MONTH_KEY = /^(\d{4})-(\d{2})/;

/** `"2026-09-14"` or `"2026-09-14T18:00:00Z"` -> `"2026-09"` */
export function monthKey(isoDate: string): string {
  const match = MONTH_KEY.exec(isoDate);
  if (!match) throw new Error(`Cannot derive month from date: ${isoDate}`);
  return `${match[1]}-${match[2]}`;
}

export function isValidMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * Every month shard touched by a date range, inclusive. A week spanning a month
 * boundary needs both shards fetched, which is why this exists.
 */
export function monthsInRange(startIso: string, endIso: string): string[] {
  const start = monthKey(startIso);
  const end = monthKey(endIso);
  if (start > end) return [];

  const months: string[] = [];
  let [year, month] = start.split('-').map(Number);

  for (;;) {
    const key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key === end) break;
    // Guard against a malformed range spinning forever.
    if (months.length > 600) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

/** `"2026-09-14"` — local date, not UTC, so "today" matches the wall calendar. */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Monday-based, matching Swedish convention. */
export function startOfWeekIso(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return todayIso(date);
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

/** The seven `YYYY-MM-DD` dates of the week containing `isoDate`. */
export function weekDates(isoDate: string): string[] {
  const monday = startOfWeekIso(isoDate);
  return Array.from({ length: 7 }, (_, index) => addDaysIso(monday, index));
}

/** Clamps to the last day of the target month, so 31 Jan + 1 month is 28/29 Feb. */
export function addMonthsIso(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return todayIso(target);
}

/** The next occurrence of a recurring item, or null if it does not recur. */
export function nextOccurrence(
  from: string,
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | undefined,
): string | null {
  switch (recurrence) {
    case 'daily':
      return addDaysIso(from, 1);
    case 'weekly':
      return addDaysIso(from, 7);
    case 'monthly':
      return addMonthsIso(from, 1);
    default:
      return null;
  }
}
