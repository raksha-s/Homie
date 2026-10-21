import { describe, expect, it } from "vitest";
import { checkPlan, generatePlan } from "./planner";
import type { DayRequest, Food, Meal, Preference } from "./types";

let n = 0;
const food = (
  type: Food["type"],
  name: string,
  meals: Meal[] = [],
  preferences: Preference[] = [],
): Food => ({ id: `f${++n}`, type, name, meals, preferences, created_at: "" });

const ALL: Meal[] = ["breakfast", "lunch", "snack", "dinner"];
// 2026-10-18 is a Sunday.
const WEEK = Array.from({ length: 7 }, (_, i) => `2026-10-${18 + i}`);
const week = (): DayRequest[] => WEEK.map((date) => ({ date, meals: ALL }));
const namesAt = (items: { date: string; meal: string; food_id: string }[], foods: Food[], date: string, meal: string) =>
  items
    .filter((i) => i.date === date && i.meal === meal)
    .map((i) => foods.find((f) => f.id === i.food_id)!.name)
    .sort();

describe("the example from the brief", () => {
  const pulav = food("dish", "Pulav", ["breakfast", "lunch", "dinner"], ["nutrition_like"]);
  const maggi = food("dish", "Maggi", ["snack"], ["unhealthy_like"]);
  const eggs = food("dish", "Boiled eggs", ["breakfast"], ["nutrition_dislike"]);
  const banana = food("fruit", "Banana");
  const seeds = food("snack", "Pumpkin seeds");
  const foods = [pulav, maggi, eggs, banana, seeds];

  it("gives eggs + fruit, Pulav + seeds, Maggi, Pulav", () => {
    const { items } = generatePlan(foods, [{ date: WEEK[3], meals: ALL }]);
    expect(namesAt(items, foods, WEEK[3], "breakfast")).toEqual(["Banana", "Boiled eggs"]);
    expect(namesAt(items, foods, WEEK[3], "lunch")).toEqual(["Pulav", "Pumpkin seeds"]);
    expect(namesAt(items, foods, WEEK[3], "snack")).toEqual(["Maggi"]);
    expect(namesAt(items, foods, WEEK[3], "dinner")).toEqual(["Pulav"]);
  });

  it("only plans the meals that were ticked", () => {
    const { items } = generatePlan(foods, [{ date: WEEK[3], meals: ["lunch", "dinner"] }]);
    expect(new Set(items.map((i) => i.meal))).toEqual(new Set(["lunch", "dinner"]));
  });
});

describe("a full week with plenty of dishes", () => {
  const foods = [
    food("dish", "Dosa", ["breakfast", "dinner"], ["love"]),
    food("dish", "Idli", ["breakfast", "dinner"], ["nutrition_like"]),
    food("dish", "Upma", ["breakfast"], []),
    food("dish", "Poha", ["breakfast"], ["love"]),
    food("dish", "Oats", ["breakfast"], ["nutrition_dislike"]),
    food("dish", "Pulav", ["breakfast", "lunch", "dinner"], ["nutrition_like", "heavy"]),
    food("dish", "Dal rice", ["lunch", "dinner"], ["nutrition_like"]),
    food("dish", "Chapati sabzi", ["lunch", "dinner"], ["nutrition_like"]),
    food("dish", "Khichdi", ["lunch", "dinner"], ["nutrition_like", "heavy"]),
    food("dish", "Curd rice", ["lunch", "dinner"], []),
    food("dish", "Rajma", ["lunch", "dinner"], ["love", "heavy"]),
    food("dish", "Biryani", ["lunch", "dinner"], ["long_like", "heavy"]),
    food("dish", "Maggi", ["snack"], ["unhealthy_like"]),
    food("dish", "Sprouts", ["snack"], ["nutrition_dislike"]),
    food("dish", "Sundal", ["snack"], []),
    food("dish", "Roasted chana", ["snack"], ["nutrition_like"]),
    food("dish", "Milk", ["breakfast"], ["daily"]),
    food("fruit", "Banana"),
    food("fruit", "Apple"),
    food("snack", "Pumpkin seeds"),
  ];

  it("breaks none of the rules", () => {
    const { items } = generatePlan(foods, week());
    const check = checkPlan(foods, week(), items);
    expect(check.hard).toEqual([]);
  });

  it("puts a fruit on every day and the daily essential on every day", () => {
    const { items } = generatePlan(foods, week());
    const fruit = foods.filter((f) => f.type === "fruit").map((f) => f.id);
    const milk = foods.find((f) => f.name === "Milk")!.id;
    for (const date of WEEK) {
      expect(items.some((i) => i.date === date && fruit.includes(i.food_id))).toBe(true);
      expect(items.some((i) => i.date === date && i.food_id === milk)).toBe(true);
    }
  });

  it("keeps long-to-make dishes to the weekend", () => {
    const { items } = generatePlan(foods, week());
    const biryani = foods.find((f) => f.name === "Biryani")!.id;
    for (const i of items.filter((x) => x.food_id === biryani)) {
      expect(["2026-10-18", "2026-10-24"]).toContain(i.date); // Sunday, Saturday
    }
  });

  it("a different shuffle gives a different but still valid plan", () => {
    const a = generatePlan(foods, week(), 1).items;
    const b = generatePlan(foods, week(), 2).items;
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
    expect(checkPlan(foods, week(), b).hard).toEqual([]);
  });

  it("starts part way through the week", () => {
    const days = week().slice(3);
    const { items } = generatePlan(foods, days);
    expect(items.every((i) => i.date >= WEEK[3])).toBe(true);
    expect(checkPlan(foods, days, items).hard).toEqual([]);
  });
});

describe("the variety rules", () => {
  it("never puts a heavy dish on back-to-back days, and light dishes at most two days running", () => {
    const heavy = food("dish", "Pulav", ["lunch"], ["heavy"]);
    const light = food("dish", "Dosa", ["lunch"], []);
    const other = food("dish", "Dal rice", ["lunch"], []);
    const foods = [heavy, light, other];
    const days = WEEK.map((date) => ({ date, meals: ["lunch" as Meal] }));
    const { items } = generatePlan(foods, days);
    const check = checkPlan(foods, days, items);
    expect(check.hard.filter((m) => /back-to-back|three days/.test(m))).toEqual([]);
  });

  it("still makes a plan with too few dishes, and says which dish repeats too much", () => {
    const only = food("dish", "Pulav", ["lunch"], ["heavy"]);
    const days = WEEK.map((date) => ({ date, meals: ["lunch" as Meal] }));
    const { items } = generatePlan([only], days);
    expect(items.length).toBeGreaterThan(0);
    const check = checkPlan([only], days, items);
    expect(check.hard.join(" ")).toContain("Pulav");
  });

  it("reports a meal nobody can cover", () => {
    const dinnerOnly = food("dish", "Dal rice", ["dinner"], []);
    const days = [{ date: WEEK[1], meals: ["breakfast" as Meal, "dinner" as Meal] }];
    const { items } = generatePlan([dinnerOnly], days);
    expect(checkPlan([dinnerOnly], days, items).soft.join(" ")).toMatch(/Nothing planned for breakfast/);
  });
});

describe("checkPlan on a hand-edited plan", () => {
  const pulav = food("dish", "Pulav", ["lunch", "dinner"], ["heavy"]);
  const banana = food("fruit", "Banana");
  const days: DayRequest[] = [
    { date: WEEK[1], meals: ["lunch"] },
    { date: WEEK[2], meals: ["lunch"] },
  ];

  it("flags a heavy dish two days running", () => {
    const items = [
      { date: WEEK[1], meal: "lunch" as Meal, food_id: pulav.id },
      { date: WEEK[2], meal: "lunch" as Meal, food_id: pulav.id },
    ];
    expect(checkPlan([pulav, banana], days, items).hard.join(" ")).toMatch(/Pulav.*back-to-back/);
  });

  it("flags a dish put in a meal it is not allowed for", () => {
    const items = [{ date: WEEK[1], meal: "breakfast" as Meal, food_id: pulav.id }];
    expect(checkPlan([pulav], days, items).hard.join(" ")).toMatch(/Pulav.*breakfast/);
  });

  it("accepts a clean plan", () => {
    const items = [
      { date: WEEK[1], meal: "lunch" as Meal, food_id: pulav.id },
      { date: WEEK[1], meal: "lunch" as Meal, food_id: banana.id },
      { date: WEEK[2], meal: "lunch" as Meal, food_id: banana.id },
    ];
    expect(checkPlan([pulav, banana], days, items).hard).toEqual([]);
  });
});

import { planWindow } from "./window";

describe("planWindow", () => {
  const at = (iso: string, h: number, m = 0) => {
    const [y, mo, d] = iso.split("-").map(Number);
    return new Date(y, mo - 1, d, h, m);
  };

  it("Sunday morning gives the whole week", () => {
    const { days } = planWindow(at("2026-10-18", 6));
    expect(days.map((d) => d.date)).toEqual(WEEK);
    expect(days[0].meals).toEqual(ALL);
  });

  it("Sunday 11 AM starts with lunch", () => {
    const { days } = planWindow(at("2026-10-18", 11));
    expect(days[0].meals).toEqual(["lunch", "snack", "dinner"]);
    expect(days[1].meals).toEqual(ALL);
  });

  it("Wednesday runs to Saturday", () => {
    const { days } = planWindow(at("2026-10-21", 6));
    expect(days.map((d) => d.date)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
  });

  it("Saturday evening has only what is left of Saturday", () => {
    const { days } = planWindow(at("2026-10-24", 18));
    expect(days).toEqual([{ date: "2026-10-24", meals: ["dinner"] }]);
  });
});
