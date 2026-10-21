import { addDays, normTime, todayISO, weekday, type ISODate } from "../../lib/dates";
import { MEALS, MEAL_TIME, type DayRequest, type Meal } from "./types";

/**
 * The days a new plan covers: from now to Saturday night (the week runs Sunday to Saturday).
 * Meals whose time has already passed today are left out, so a plan made at 11 AM starts at lunch.
 */
export function planWindow(now = new Date()): { days: DayRequest[]; past: Set<Meal> } {
  const today: ISODate = todayISO(now);
  const clock = normTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`) ?? "00:00";
  const past = new Set<Meal>(MEALS.filter((m) => MEAL_TIME[m] <= clock));
  const length = 7 - weekday(today);
  const days = Array.from({ length }, (_, i) => ({
    date: addDays(today, i),
    meals: MEALS.filter((m) => i > 0 || !past.has(m)),
  }));
  return { days: days.filter((d) => d.meals.length), past };
}
