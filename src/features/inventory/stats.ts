import { dayNumber, addDays, type ISODate } from "../../lib/dates";
import type { InventoryItem, Restock } from "./types";

export type ItemStats = {
  state: "in_stock" | "over";
  lastRestock: ISODate | null;
  /** This restock minus the one before it. Null until there are two restocks. */
  daysLasted: number | null;
  predictedOn: ISODate | null;
  /** Negative when the prediction has passed. */
  daysLeft: number | null;
};

export function itemStats(item: InventoryItem, restocks: Restock[], today: ISODate): ItemStats {
  const dates = restocks
    .filter((r) => r.item_id === item.id)
    .map((r) => r.restock_date)
    .sort();
  const lastRestock = dates.length ? dates[dates.length - 1] : null;
  const daysLasted =
    dates.length >= 2 ? dayNumber(dates[dates.length - 1]) - dayNumber(dates[dates.length - 2]) : null;
  const predictedOn = lastRestock && daysLasted !== null ? addDays(lastRestock, daysLasted) : null;
  const daysLeft = predictedOn ? dayNumber(predictedOn) - dayNumber(today) : null;
  return { state: item.over_on ? "over" : "in_stock", lastRestock, daysLasted, predictedOn, daysLeft };
}

export function describeLeft(daysLeft: number): string {
  if (daysLeft > 1) return `About ${daysLeft} days left`;
  if (daysLeft === 1) return "About 1 day left";
  if (daysLeft === 0) return "Should run out today";
  const late = -daysLeft;
  return `Past the predicted date by ${late} ${late === 1 ? "day" : "days"}`;
}
