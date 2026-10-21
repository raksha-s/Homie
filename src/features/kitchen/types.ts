import type { ISODate } from "../../lib/dates";

export type FoodType = "fruit" | "snack" | "dish";
export type Meal = "breakfast" | "lunch" | "snack" | "dinner";

export const MEALS: Meal[] = ["breakfast", "lunch", "snack", "dinner"];
export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};
/** When each meal lands on My Tasks once a plan is published. */
export const MEAL_TIME: Record<Meal, string> = { breakfast: "07:00", lunch: "12:00", snack: "17:00", dinner: "20:00" };

/** Stored in foods.preferences. "heavy" is the Light/Heavy choice; a dish without it is light. */
export type Preference =
  | "daily"
  | "nutrition_dislike"
  | "nutrition_like"
  | "unhealthy_like"
  | "love"
  | "long_like"
  | "long_nutritious"
  | "heavy";

export const PREFERENCES: { key: Exclude<Preference, "heavy">; label: string; help: string }[] = [
  { key: "daily", label: "I need to eat this every day", help: "A daily essential, like milk." },
  { key: "nutrition_dislike", label: "I don't like this but I need it for nutrition", help: "Healthy things you find yucky." },
  { key: "nutrition_like", label: "I like this and I need it for nutrition", help: "Healthy and tasty." },
  { key: "unhealthy_like", label: "I like this but it's unhealthy", help: "A treat that balances the healthy food." },
  { key: "love", label: "I love eating this", help: "A favourite." },
  { key: "long_like", label: "This takes long to make but I like it", help: "Lands on weekends." },
  { key: "long_nutritious", label: "This takes long to make but it's nutritious", help: "Healthy food for weekends." },
];

export type Food = {
  id: string;
  type: FoodType;
  name: string;
  meals: Meal[];
  preferences: Preference[];
  created_at: string;
};

/** The meals wanted on one day. */
export type DayRequest = { date: ISODate; meals: Meal[] };

export type PlanItem = { date: ISODate; meal: Meal; food_id: string };

export type PlanCheck = {
  /** Breaks a rule you set (variety, heavy dishes, allowed meals). */
  hard: string[];
  /** Worth knowing, but not a broken rule (no fruit, an empty meal, a long dish on a weekday). */
  soft: string[];
};
