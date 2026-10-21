import { describe, expect, it } from "vitest";
import { describeLeft, itemStats } from "./stats";
import type { InventoryItem, Restock } from "./types";

const item = (over_on: string | null = null): InventoryItem => ({
  id: "i1",
  name: "Detergent",
  over_on,
  restock_task_id: null,
  created_at: "",
});
const r = (restock_date: string, item_id = "i1"): Restock => ({ id: restock_date + item_id, item_id, restock_date, created_at: "" });

describe("itemStats", () => {
  it("has nothing to say before any restock", () => {
    const s = itemStats(item(), [], "2026-10-21");
    expect(s).toMatchObject({ lastRestock: null, daysLasted: null, predictedOn: null, daysLeft: null, state: "in_stock" });
  });

  it("needs a second restock before predicting", () => {
    const s = itemStats(item(), [r("2026-10-01")], "2026-10-21");
    expect(s.lastRestock).toBe("2026-10-01");
    expect(s.daysLasted).toBeNull();
    expect(s.daysLeft).toBeNull();
  });

  it("days lasted is the gap between the last two restocks, and the prediction adds it to the last", () => {
    const s = itemStats(item(), [r("2026-10-15"), r("2026-09-01"), r("2026-09-21")], "2026-10-21");
    expect(s.daysLasted).toBe(24); // 21 Sep -> 15 Oct
    expect(s.predictedOn).toBe("2026-11-08");
    expect(s.daysLeft).toBe(18);
  });

  it("ignores other items' restocks", () => {
    const s = itemStats(item(), [r("2026-09-01"), r("2026-09-21", "other")], "2026-10-21");
    expect(s.daysLasted).toBeNull();
  });

  it("goes negative once the prediction has passed, and reports over items", () => {
    const s = itemStats(item("2026-10-20"), [r("2026-09-01"), r("2026-09-11")], "2026-10-21");
    expect(s.daysLeft).toBe(-30);
    expect(s.state).toBe("over");
  });
});

describe("describeLeft", () => {
  it("words each case", () => {
    expect(describeLeft(12)).toBe("About 12 days left");
    expect(describeLeft(1)).toBe("About 1 day left");
    expect(describeLeft(0)).toBe("Should run out today");
    expect(describeLeft(-1)).toBe("Past the predicted date by 1 day");
    expect(describeLeft(-10)).toBe("Past the predicted date by 10 days");
  });
});
