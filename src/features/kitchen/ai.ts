import { formatDay } from "../../lib/dates";
import { checkPlan, generatePlan } from "./planner";
import { MEALS, PREFERENCES, type DayRequest, type Food, type Meal, type PlanItem } from "./types";

/**
 * Optional help from Google Gemini's free tier. The key is the user's own and stays in this browser.
 * Whatever Gemini suggests is checked against the same rules as the built-in planner, and anything
 * that goes wrong falls back to the built-in plan, so the AI can never make things worse.
 */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";
const ENDPOINT = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const KEY_STORAGE = "homie.gemini.key";

export const loadGeminiKey = (): string => {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
};
export const saveGeminiKey = (key: string) => {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* private browsing: the key just will not be remembered */
  }
};

export function buildPrompt(foods: Food[], days: DayRequest[], seed: number): string {
  const label = new Map(PREFERENCES.map((p) => [p.key, p.label]));
  const lines = foods.map((f) => {
    if (f.type !== "dish") return `- ${f.name} (${f.type})`;
    const tags = f.preferences.filter((p) => p !== "heavy").map((p) => label.get(p as never)).filter(Boolean);
    return `- ${f.name} (dish; allowed at: ${f.meals.join(", ")}; ${f.preferences.includes("heavy") ? "HEAVY" : "light"}${tags.length ? `; ${tags.join("; ")}` : ""})`;
  });
  const wanted = days.map((d) => `- ${d.date} (${formatDay(d.date)}): ${d.meals.join(", ")}`);
  return [
    "You plan a person's meals. Choose only from the foods listed, using their exact names. Never give recipes.",
    "",
    "Foods:",
    ...lines,
    "",
    "Days and meals to fill:",
    ...wanted,
    "",
    "Rules, all required:",
    "- A dish only goes in a meal it is allowed at.",
    "- A HEAVY dish is never on two days in a row. A light dish is on at most two days in a row.",
    "- No food except a dish marked 'every day' and fruit is on more than 2 different days.",
    "- Put one fruit on every day, with any meal. Put a dish marked 'every day' on every day.",
    "- Prefer using the same dish for 2 meals of one day to reduce cooking.",
    "- Dishes that take long to make go on Saturday or Sunday.",
    "- Weigh nutrition 50%, how much the person likes it 20%, low effort 30%.",
    "- Fill every listed meal. A plain snack-type food can be added next to a meal now and then.",
    "",
    `Variation number: ${seed}. Make this plan different from other variation numbers.`,
    'Reply with JSON only, shaped {"items":[{"date":"YYYY-MM-DD","meal":"breakfast|lunch|snack|dinner","food":"exact name"}]}. A meal can have several items.',
  ].join("\n");
}

/** Reads Gemini's reply into plan items. Throws when it is not usable. */
export function parseSuggestion(text: string, foods: Food[]): PlanItem[] {
  const clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let data: unknown;
  try {
    data = JSON.parse(clean);
  } catch {
    throw new Error("Gemini's reply was not in the expected format.");
  }
  const list = Array.isArray(data) ? data : (data as { items?: unknown })?.items;
  if (!Array.isArray(list) || !list.length) throw new Error("Gemini's reply had no meals in it.");
  const byName = new Map(foods.map((f) => [f.name.trim().toLowerCase(), f]));
  return list.map((raw) => {
    const r = raw as { date?: unknown; meal?: unknown; food?: unknown };
    const food = typeof r.food === "string" ? byName.get(r.food.trim().toLowerCase()) : undefined;
    const meal = typeof r.meal === "string" ? (r.meal.toLowerCase() as Meal) : undefined;
    if (!food || !meal || !MEALS.includes(meal) || typeof r.date !== "string")
      throw new Error("Gemini suggested something that is not in your list.");
    return { date: r.date, meal, food_id: food.id };
  });
}

export type PlanSource = "ai" | "rules";
export type PlanOutcome = { items: PlanItem[]; source: PlanSource; note: string | null };

/** Tries Gemini (when there is a key) and always returns a plan that follows the rules. */
export async function planWithGemini(args: {
  key: string;
  foods: Food[];
  days: DayRequest[];
  seed: number;
  fetchImpl?: typeof fetch;
}): Promise<PlanOutcome> {
  const { key, foods, days, seed, fetchImpl = fetch } = args;
  const builtIn = (note: string | null): PlanOutcome => ({ items: generatePlan(foods, days, seed).items, source: "rules", note });
  if (!key) return builtIn(null);
  try {
    const res = await fetchImpl(ENDPOINT(GEMINI_MODEL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(foods, days, seed) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
      }),
    });
    if (!res.ok) {
      const reason =
        res.status === 429
          ? "the free limit for now has been used"
          : res.status === 400 || res.status === 403
            ? "the key was not accepted"
            : `Google answered ${res.status}`;
      return builtIn(`Gemini could not help (${reason}), so Homie used its built-in plan.`);
    }
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const items = parseSuggestion(text, foods);
    const check = checkPlan(foods, days, items);
    const problems = [...check.hard, ...check.soft.filter((s) => !/takes long/.test(s))];
    if (problems.length) return builtIn("Gemini's plan broke some of your rules, so Homie used its built-in plan.");
    return { items, source: "ai", note: "Planned with Gemini and checked against your rules." };
  } catch (e) {
    const why = e instanceof Error && !/fetch|network/i.test(e.message) ? ` (${e.message})` : "";
    return builtIn(`Gemini could not help${why}, so Homie used its built-in plan.`);
  }
}
