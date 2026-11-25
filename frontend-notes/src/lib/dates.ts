/** Dates are plain yyyy-mm-dd strings in the Oslo calendar; all arithmetic is done in UTC. */

const TIME_ZONE = 'Europe/Oslo';

export function todayInOslo(now: Date = new Date()): string {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && fromUtc(toUtc(date)) === date;
}

/** ISO-8601 week key, e.g. "2026-W48". */
export function isoWeekKey(date: string): string {
  const d = toUtc(date);
  const weekday = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - weekday + 3); // Thursday decides the year
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Monday of an ISO week key, or null if the key is malformed. */
export function mondayOfWeek(key: string): string | null {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mondayWeek1 = addDays(fromUtc(jan4), -((jan4.getUTCDay() + 6) % 7));
  const monday = addDays(mondayWeek1, (week - 1) * 7);
  return isoWeekKey(monday) === `${year}-W${String(week).padStart(2, '0')}` ? monday : null;
}

const weekdayFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', timeZone: 'UTC' });
const dayMonthFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Mandag 23. november", the way the OneNote pages were titled. */
export function dayTitle(date: string): string {
  return `${capitalize(weekdayFormat.format(toUtc(date)))} ${dayMonthFormat.format(toUtc(date))}`;
}

/** "fre. 20.11." for compact hints. */
export function shortDay(date: string): string {
  return shortFormat.format(toUtc(date));
}

export function weekNumber(key: string): number {
  return Number(key.split('-W')[1]);
}

const shortWeekdayFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', timeZone: 'UTC' });
const shortMonthFormat = new Intl.DateTimeFormat('nb-NO', { month: 'short', timeZone: 'UTC' });
const dayOfMonth = (date: string) => Number(date.slice(8, 10));

/** "Man 23." for the sidebar's day rows. */
export function sidebarDayLabel(date: string): string {
  return `${capitalize(shortWeekdayFormat.format(toUtc(date)).replace('.', ''))} ${dayOfMonth(date)}.`;
}

/** "23.–29. nov", or "30. nov–6. des" across a month boundary. */
export function weekRange(monday: string): string {
  const sunday = addDays(monday, 6);
  const month = (date: string) => shortMonthFormat.format(toUtc(date)).replace('.', '');
  return month(monday) === month(sunday)
    ? `${dayOfMonth(monday)}.–${dayOfMonth(sunday)}. ${month(sunday)}`
    : `${dayOfMonth(monday)}. ${month(monday)}–${dayOfMonth(sunday)}. ${month(sunday)}`;
}
