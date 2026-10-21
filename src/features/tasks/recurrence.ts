import {
  dayNumber,
  daysInMonth,
  parseISO,
  weekday,
  type ISODate,
} from "../../lib/dates";
import type { Recurrence, Task } from "./types";

/** Weekdays (Mon to Fri) in the half-open day range [from, to). */
function weekdaysBetween(from: number, to: number): number {
  let count = 0;
  for (let n = from; n < to; n++) {
    const dow = new Date(n * 86_400_000).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function recurrenceUntil(r: Recurrence): ISODate | null {
  return "until" in r ? r.until : null;
}

/**
 * Does this task fall on `date`? Pure and date-only. Restock rollover is handled by the caller.
 * `ignoreStart` answers "does the pattern hit this weekday" for days before the task began,
 * which the weekday strip on a card uses so a task created on Wednesday still shows a full pattern.
 */
export function occursOn(
  task: Pick<Task, "start_date" | "recurrence">,
  date: ISODate,
  opts: { ignoreStart?: boolean } = {},
): boolean {
  const { start_date: start, recurrence: r } = task;
  if (date < start && !opts.ignoreStart) return false;
  const until = recurrenceUntil(r);
  if (until && date > until) return false;

  const diff = dayNumber(date) - dayNumber(start);
  const dow = weekday(date);

  switch (r.type) {
    case "once":
      return date === start;
    case "yearly": {
      const s = parseISO(start);
      const d = parseISO(date);
      if (s.m === d.m && s.d === d.d) return true;
      // A 29 February birthday is marked on 28 February in common years.
      return s.m === 2 && s.d === 29 && d.m === 2 && d.d === 28 && daysInMonth(d.y, 2) === 28;
    }
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekends":
      return dow === 0 || dow === 6;
    case "alternate_day":
      return Math.abs(diff) % 2 === 0;
    case "alternate_weekday": {
      if (dow === 0 || dow === 6) return false;
      const [a, b] = date < start ? [dayNumber(date), dayNumber(start)] : [dayNumber(start), dayNumber(date)];
      return weekdaysBetween(a, b) % 2 === 0;
    }
    case "weekly":
      return r.days.includes(dow);
    case "monthly": {
      const s = parseISO(start);
      const d = parseISO(date);
      const lastDay = daysInMonth(d.y, d.m);
      return d.d === Math.min(s.d, lastDay);
    }
  }
}
