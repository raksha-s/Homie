// Dates travel as local "YYYY-MM-DD" strings and times as "HH:MM". Day arithmetic goes through
// UTC day numbers so daylight-saving changes can never shift a date.

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now = new Date()): ISODate {
  return toISO(now);
}

export function parseISO(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function dayNumber(iso: ISODate): number {
  const { y, m, d } = parseISO(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayNumber(n: number): ISODate {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromDayNumber(dayNumber(iso) + days);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(iso: ISODate): number {
  return new Date(dayNumber(iso) * 86_400_000).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso));
}

/** Time helpers. Postgres returns "HH:MM:SS"; the app works in "HH:MM". */
export function normTime(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function nowTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const weekdayLong = (i: number) => WEEKDAYS_LONG[i];

export function formatDay(iso: ISODate): string {
  const { m, d } = parseISO(iso);
  return `${WEEKDAYS_LONG[weekday(iso)]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatDayShort(iso: ISODate): string {
  const { y, m, d } = parseISO(iso);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** The Saturday to shop on: today if it is Saturday, otherwise the next one. */
export function comingSaturday(from: ISODate): ISODate {
  return addDays(from, (6 - weekday(from) + 7) % 7);
}
