import { minutesToTime, normTime, timeToMinutes, type ISODate } from "../../lib/dates";
import { occursOn } from "./recurrence";
import type { Task } from "./types";

export const SLOT_START = 6 * 60;
export const SLOT_END = 23 * 60;
export const SLOT_STEP = 30;
/** Normal scheduling puts one task in a slot. "Pick manually" may share a slot, but never beyond two. */
export const MAX_PER_SLOT = 2;

export const ALL_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = SLOT_START; m <= SLOT_END; m += SLOT_STEP) out.push(minutesToTime(m));
  return out;
})();

/** How many tasks sit in each slot on `date`. `ignoreId` lets a task being edited not block itself. */
export function slotCounts(
  tasks: Task[],
  date: ISODate,
  ignoreId?: string,
  /** Lets the caller supply a per-day time override (a recurring task moved for one day). */
  timeFor: (task: Task) => string | null = (t) => normTime(t.time),
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.id === ignoreId || !occursOn(t, date)) continue;
    const time = timeFor(t);
    if (!time) continue;
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  return counts;
}

export type SlotState = "free" | "shared" | "full";

export function slotState(counts: Map<string, number>, time: string): SlotState {
  const n = counts.get(time) ?? 0;
  if (n === 0) return "free";
  return n < MAX_PER_SLOT ? "shared" : "full";
}

/** First free slot at or after `afterTime` (inclusive), else the first free slot of the day. */
export function suggestSlot(counts: Map<string, number>, afterTime?: string): string | null {
  const min = afterTime ? timeToMinutes(afterTime) : SLOT_START;
  const free = (t: string) => slotState(counts, t) === "free";
  return (
    ALL_SLOTS.find((t) => timeToMinutes(t) >= min && free(t)) ?? ALL_SLOTS.find(free) ?? null
  );
}

/** Round a time up to the next 30-minute slot boundary. */
export function nextSlotAfter(time: string): string {
  const m = Math.ceil(timeToMinutes(time) / SLOT_STEP) * SLOT_STEP;
  return minutesToTime(Math.min(Math.max(m, SLOT_START), SLOT_END));
}
