import { describe, expect, it } from "vitest";
import { occursOn } from "./recurrence";
import { ALL_SLOTS, nextSlotAfter, slotCounts, slotState, suggestSlot } from "./slots";
import type { Recurrence, Task } from "./types";

const t = (start_date: string, recurrence: Recurrence, extra: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "x",
  category: "routine",
  time: "09:00",
  start_date,
  recurrence,
  add_to_gcal: false,
  gcal_event_id: null,
  source: "manual",
  source_ref: null,
  target: null,
  created_at: "",
  ...extra,
});

// 2026-10-21 is a Wednesday.
describe("occursOn", () => {
  it("once happens only on its date", () => {
    const task = t("2026-10-21", { type: "once" });
    expect(occursOn(task, "2026-10-21")).toBe(true);
    expect(occursOn(task, "2026-10-22")).toBe(false);
    expect(occursOn(task, "2026-10-20")).toBe(false);
  });

  it("daily respects start and until", () => {
    const task = t("2026-10-21", { type: "daily", until: "2026-10-23" });
    expect(occursOn(task, "2026-10-20")).toBe(false);
    expect(occursOn(task, "2026-10-21")).toBe(true);
    expect(occursOn(task, "2026-10-23")).toBe(true);
    expect(occursOn(task, "2026-10-24")).toBe(false);
  });

  it("indefinite has no end", () => {
    expect(occursOn(t("2026-10-21", { type: "daily", until: null }), "2030-01-01")).toBe(true);
  });

  it("weekdays and weekends", () => {
    const wd = t("2026-10-19", { type: "weekdays", until: null });
    expect(occursOn(wd, "2026-10-23")).toBe(true); // Friday
    expect(occursOn(wd, "2026-10-24")).toBe(false); // Saturday
    const we = t("2026-10-19", { type: "weekends", until: null });
    expect(occursOn(we, "2026-10-24")).toBe(true);
    expect(occursOn(we, "2026-10-25")).toBe(true);
    expect(occursOn(we, "2026-10-26")).toBe(false);
  });

  it("alternate day", () => {
    const task = t("2026-10-21", { type: "alternate_day", until: null });
    expect(occursOn(task, "2026-10-22")).toBe(false);
    expect(occursOn(task, "2026-10-23")).toBe(true);
    expect(occursOn(task, "2026-10-25")).toBe(true);
  });

  it("alternate weekday skips weekends and keeps counting weekdays", () => {
    // Wed 21 yes, Thu 22 no, Fri 23 yes, Mon 26 no, Tue 27 yes
    const task = t("2026-10-21", { type: "alternate_weekday", until: null });
    expect(occursOn(task, "2026-10-21")).toBe(true);
    expect(occursOn(task, "2026-10-22")).toBe(false);
    expect(occursOn(task, "2026-10-23")).toBe(true);
    expect(occursOn(task, "2026-10-24")).toBe(false);
    expect(occursOn(task, "2026-10-26")).toBe(false);
    expect(occursOn(task, "2026-10-27")).toBe(true);
  });

  it("weekly on one or two days", () => {
    const one = t("2026-10-21", { type: "weekly", days: [3], until: null }); // Wednesday
    expect(occursOn(one, "2026-10-28")).toBe(true);
    expect(occursOn(one, "2026-10-29")).toBe(false);
    const two = t("2026-10-21", { type: "weekly", days: [2, 5], until: null }); // Tue, Fri
    expect(occursOn(two, "2026-10-23")).toBe(true);
    expect(occursOn(two, "2026-10-27")).toBe(true);
    expect(occursOn(two, "2026-10-28")).toBe(false);
  });

  it("monthly clamps to the last day of short months", () => {
    const task = t("2026-01-31", { type: "monthly", until: null });
    expect(occursOn(task, "2026-02-28")).toBe(true);
    expect(occursOn(task, "2026-02-27")).toBe(false);
    expect(occursOn(task, "2026-03-31")).toBe(true);
    expect(occursOn(task, "2026-04-30")).toBe(true);
  });

  it("yearly birthdays repeat on the same month and day", () => {
    const task = t("1995-05-12", { type: "yearly" });
    expect(occursOn(task, "2027-05-12")).toBe(true);
    expect(occursOn(task, "2027-05-13")).toBe(false);
    const leap = t("1996-02-29", { type: "yearly" });
    expect(occursOn(leap, "2027-02-28")).toBe(true);
    expect(occursOn(leap, "2028-02-29")).toBe(true);
    expect(occursOn(leap, "2028-02-28")).toBe(false);
  });
});

describe("slots", () => {
  it("covers 06:00 to 23:00 in 30 minute steps", () => {
    expect(ALL_SLOTS[0]).toBe("06:00");
    expect(ALL_SLOTS.at(-1)).toBe("23:00");
    expect(ALL_SLOTS).toHaveLength(35);
  });

  it("treats one task as shared and two as full", () => {
    const a = t("2026-10-21", { type: "once" }, { id: "a", time: "09:00" });
    const b = t("2026-10-21", { type: "once" }, { id: "b", time: "09:00" });
    const c = t("2026-10-21", { type: "once" }, { id: "c", time: "09:00" });
    expect(slotState(slotCounts([a], "2026-10-21"), "09:00")).toBe("shared");
    expect(slotState(slotCounts([a, b], "2026-10-21"), "09:00")).toBe("full");
    expect(slotState(slotCounts([a, b, c], "2026-10-21"), "09:30")).toBe("free");
  });

  it("ignores the task being edited", () => {
    const a = t("2026-10-21", { type: "once" }, { id: "a", time: "09:00" });
    expect(slotState(slotCounts([a], "2026-10-21", "a"), "09:00")).toBe("free");
  });

  it("only counts tasks that happen on that date", () => {
    const a = t("2026-10-21", { type: "once" }, { id: "a", time: "09:00" });
    expect(slotCounts([a], "2026-10-22").size).toBe(0);
  });

  it("suggests the first free slot after a time, skipping taken ones", () => {
    const a = t("2026-10-21", { type: "once" }, { id: "a", time: "09:00" });
    const counts = slotCounts([a], "2026-10-21");
    expect(suggestSlot(counts, "09:00")).toBe("09:30");
    expect(suggestSlot(counts)).toBe("06:00");
  });

  it("rounds up to the next slot", () => {
    expect(nextSlotAfter("09:01")).toBe("09:30");
    expect(nextSlotAfter("09:30")).toBe("09:30");
    expect(nextSlotAfter("03:10")).toBe("06:00");
    expect(nextSlotAfter("23:40")).toBe("23:00");
  });
});
