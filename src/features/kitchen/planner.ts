import { addDays, formatDay, weekday, type ISODate } from "../../lib/dates";
import { MEALS, MEAL_LABEL, type DayRequest, type Food, type Meal, type PlanCheck, type PlanItem } from "./types";

/**
 * The meal planner. It is a rule engine that runs in the browser, so it is free and works offline.
 * Weights: nutrition 50%, likability 20%, effort 30%. See PLAN.md, Phase 5.
 *
 * Variety rules: a heavy dish is never on back-to-back days, a light dish at most two days running,
 * and nothing except a daily essential (or fruit) is on more than two days of the week.
 */
const WEEKLY_CAP = 2;
const REUSE_BONUS = 0.35; // cooking one dish for two meals saves effort
const THIRD_USE_PENALTY = 0.6;
const VARIETY_PENALTY = 0.3; // per earlier day this week
const EMPTY_PENALTY = 1;

const FRUIT_AT: Meal[] = ["breakfast", "snack", "lunch", "dinner"];
const SNACK_FOOD_AT: Meal[] = ["lunch", "dinner", "breakfast", "snack"];

const NUTRITION: Record<string, number> = {
  daily: 1,
  nutrition_dislike: 1,
  nutrition_like: 1,
  long_nutritious: 0.9,
  love: 0.4,
  long_like: 0.5,
  unhealthy_like: 0.1,
};
const LIKING: Record<string, number> = {
  love: 1,
  nutrition_like: 0.9,
  unhealthy_like: 0.9,
  long_like: 0.9,
  long_nutritious: 0.5,
  daily: 0.5,
  nutrition_dislike: 0.1,
};

const best = (f: Food, table: Record<string, number>) =>
  f.preferences.reduce((m, p) => (p in table ? Math.max(m, table[p]) : m), f.preferences.some((p) => p in table) ? 0 : 0.5);

export const isHeavy = (f: Food) => f.preferences.includes("heavy");
export const isDaily = (f: Food) => f.preferences.includes("daily");
export const isLong = (f: Food) => f.preferences.includes("long_like") || f.preferences.includes("long_nutritious");
const isWeekend = (d: ISODate) => weekday(d) === 0 || weekday(d) === 6;

function baseScore(f: Food, date: ISODate): number {
  const effort = isLong(f) ? 0.2 : 0.8;
  let s = 0.5 * best(f, NUTRITION) + 0.2 * best(f, LIKING) + 0.3 * effort;
  if (isLong(f)) s += isWeekend(date) ? 0.4 : -0.8;
  return s;
}

/** A small repeatable wobble so a different seed shuffles ties without breaking the rules. */
function jitter(seed: number, key: string): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.08;
}

type Option = { food: Food; score: number; tier: number };

export function generatePlan(foods: Food[], days: DayRequest[], seed = 1): { items: PlanItem[] } {
  const dishes = foods.filter((f) => f.type === "dish");
  const mains = dishes.filter((f) => !isDaily(f));
  const dailyDishes = dishes.filter(isDaily);
  const fruits = foods.filter((f) => f.type === "fruit");
  const snackFoods = foods.filter((f) => f.type === "snack");

  const used = new Map<string, Set<ISODate>>();
  const usedOn = (id: string, d: ISODate) => used.get(id)?.has(d) ?? false;
  const daysUsed = (id: string) => used.get(id)?.size ?? 0;

  /** tier 0 obeys every rule; 1 lets a dish pass the weekly limit; 2 also allows back-to-back days. */
  const allowed = (f: Food, date: ISODate, tier: number): boolean => {
    if (isDaily(f)) return true;
    if (tier < 1 && daysUsed(f.id) >= WEEKLY_CAP) return false;
    if (tier < 2) {
      const y = usedOn(f.id, addDays(date, -1));
      if (isHeavy(f) ? y : y && usedOn(f.id, addDays(date, -2))) return false;
    }
    return true;
  };

  const items: PlanItem[] = [];

  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const slots = MEALS.filter((m) => day.meals.includes(m));
    if (!slots.length) continue;
    const today: PlanItem[] = [];

    // Each slot's options come from the strictest tier that has any.
    const options: Option[][] = slots.map((meal) => {
      for (let tier = 0; tier <= 2; tier++) {
        const list = mains
          .filter((f) => f.meals.includes(meal) && allowed(f, day.date, tier))
          .map((food) => ({
            food,
            tier,
            score:
              baseScore(food, day.date) -
              VARIETY_PENALTY * daysUsed(food.id) +
              jitter(seed, `${food.id}|${day.date}|${meal}`),
          }));
        if (list.length) return list;
      }
      return [];
    });

    // Try every combination (a handful of slots, a handful of dishes) and keep the best day.
    let bestTotal = -Infinity;
    let bestPick: (Option | null)[] = slots.map(() => null);
    const walk = (i: number, picks: (Option | null)[], counts: Map<string, number>, total: number) => {
      if (i === slots.length) {
        if (total > bestTotal) {
          bestTotal = total;
          bestPick = picks.slice();
        }
        return;
      }
      if (!options[i].length) {
        picks[i] = null;
        walk(i + 1, picks, counts, total - (slots[i] === "snack" ? 0 : EMPTY_PENALTY));
        return;
      }
      for (const o of options[i]) {
        const c = (counts.get(o.food.id) ?? 0) + 1;
        counts.set(o.food.id, c);
        picks[i] = o;
        walk(i + 1, picks, counts, total + o.score + (c === 2 ? REUSE_BONUS : 0) - (c >= 3 ? THIRD_USE_PENALTY : 0));
        counts.set(o.food.id, c - 1);
      }
    };
    walk(0, [], new Map(), 0);

    const eaten = new Set<string>();
    const put = (meal: Meal, food: Food) => {
      today.push({ date: day.date, meal, food_id: food.id });
      eaten.add(food.id);
    };
    slots.forEach((meal, i) => bestPick[i] && put(meal, bestPick[i]!.food));

    const leastUsed = (list: Food[], skip: Set<string> = new Set()) =>
      list
        .filter((f) => !skip.has(f.id))
        .sort(
          (a, b) =>
            daysUsed(a.id) - daysUsed(b.id) ||
            jitter(seed, `${b.id}|${day.date}`) - jitter(seed, `${a.id}|${day.date}`),
        )[0];

    // Daily essentials ride along with the first meal they are allowed at.
    for (const f of dailyDishes) {
      const meal = slots.find((m) => f.meals.includes(m)) ?? (f.meals.length ? undefined : slots[0]);
      if (meal) put(meal, f);
    }

    // Fruit is part of every day.
    const fruit = leastUsed(fruits);
    const fruitMeal = FRUIT_AT.find((m) => slots.includes(m));
    if (fruit && fruitMeal) put(fruitMeal, fruit);

    // A plain snack food (like seeds) joins a meal when its week limit allows. It can also fill an empty snack slot.
    const snack = leastUsed(snackFoods.filter((f) => allowed(f, day.date, 0)));
    if (snack) {
      const snackSlotEmpty = slots.includes("snack") && !today.some((i) => i.meal === "snack");
      const meal = snackSlotEmpty ? "snack" : SNACK_FOOD_AT.find((m) => slots.includes(m));
      if (meal) put(meal, snack);
    }
    if (slots.includes("snack") && !today.some((i) => i.meal === "snack")) {
      const second = leastUsed(fruits, new Set(today.filter((i) => i.meal === fruitMeal).map((i) => i.food_id))) ?? fruit;
      if (second) put("snack", second);
    }

    for (const id of eaten) {
      if (!used.has(id)) used.set(id, new Set());
      used.get(id)!.add(day.date);
    }
    items.push(...today);
  }

  return { items };
}

/** Looks over a plan (made by the engine, edited by hand, or suggested by AI) against the rules. */
export function checkPlan(foods: Food[], days: DayRequest[], items: PlanItem[]): PlanCheck {
  const hard = new Set<string>();
  const soft = new Set<string>();
  const byId = new Map(foods.map((f) => [f.id, f]));
  const dates = [...new Set(days.map((d) => d.date))].sort();
  const wanted = new Map(days.map((d) => [d.date, d.meals]));

  const onDay = new Map<string, Set<ISODate>>();
  for (const it of items) {
    const f = byId.get(it.food_id);
    if (!f) {
      hard.add("The plan uses a food that is no longer in your list.");
      continue;
    }
    if (!wanted.get(it.date)?.includes(it.meal))
      hard.add(`${f.name} is planned for ${MEAL_LABEL[it.meal].toLowerCase()} on ${formatDay(it.date)}, which was not ticked.`);
    if (f.type === "dish" && !f.meals.includes(it.meal) && !isDaily(f))
      hard.add(`${f.name} is planned for ${MEAL_LABEL[it.meal].toLowerCase()}, but you said it is not for that meal.`);
    if (f.type === "dish" && isLong(f) && !isWeekend(it.date))
      soft.add(`${f.name} takes long to make and is on ${formatDay(it.date)}, a weekday.`);
    if (!onDay.has(f.id)) onDay.set(f.id, new Set());
    onDay.get(f.id)!.add(it.date);
  }

  for (const [id, set] of onDay) {
    const f = byId.get(id)!;
    if (isDaily(f) || f.type === "fruit") continue;
    if (set.size > WEEKLY_CAP) hard.add(`${f.name} is on ${set.size} days. The limit is ${WEEKLY_CAP} in a week.`);
    for (const d of set) {
      if (set.has(addDays(d, 1)) && isHeavy(f)) hard.add(`${f.name} is heavy and is on back-to-back days (${formatDay(d)}).`);
      if (!isHeavy(f) && set.has(addDays(d, 1)) && set.has(addDays(d, 2)))
        hard.add(`${f.name} is on three days in a row from ${formatDay(d)}. The limit is two.`);
    }
  }

  const hasFruit = foods.some((f) => f.type === "fruit");
  if (!hasFruit && days.length) soft.add("You have not added any fruit yet.");
  for (const date of dates) {
    const todays = items.filter((i) => i.date === date);
    if (hasFruit && wanted.get(date)?.length && !todays.some((i) => byId.get(i.food_id)?.type === "fruit"))
      soft.add(`No fruit on ${formatDay(date)}.`);
    for (const meal of wanted.get(date) ?? [])
      if (!todays.some((i) => i.meal === meal))
        soft.add(`Nothing planned for ${MEAL_LABEL[meal].toLowerCase()} on ${formatDay(date)}. Add a dish that can be eaten then.`);
  }

  return { hard: [...hard], soft: [...soft] };
}
