import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { startOfWeek, todayISO, type ISODate } from "../../lib/dates";
import { useTasks } from "../tasks/TasksProvider";
import type { NewTask } from "../tasks/types";
import { checkPlan, generatePlan } from "./planner";
import { MEALS, MEAL_LABEL, MEAL_TIME, type DayRequest, type Food, type Meal, type PlanCheck, type PlanItem } from "./types";

export type Draft = { days: DayRequest[]; items: PlanItem[]; seed: number; note: string | null };
export type FoodInput = Pick<Food, "type" | "name" | "meals" | "preferences">;

type Ctx = {
  foods: Food[];
  /** Published plan items from today onward. */
  published: PlanItem[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  reload: () => Promise<void>;
  saveFood: (id: string | null, input: FoodInput) => Promise<boolean>;
  deleteFood: (id: string) => Promise<boolean>;
  draft: Draft | null;
  check: PlanCheck | null;
  /** Builds a plan with the built-in rules. */
  makePlan: (days: DayRequest[]) => void;
  setDraft: (d: Draft | null) => void;
  shuffle: () => void;
  changeItem: (index: number, foodId: string) => void;
  removeItem: (index: number) => void;
  addItem: (date: ISODate, meal: Meal, foodId: string) => void;
  publish: () => Promise<boolean>;
};

const KitchenContext = createContext<Ctx | null>(null);

function describe(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}

export function KitchenProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const tasks = useTasks();
  const [foods, setFoods] = useState<Food[]>([]);
  const [published, setPublished] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const [a, b] = await Promise.all([
      supabase.from("foods").select("*").order("created_at"),
      supabase.from("meal_plan_items").select("*").gte("date", todayISO()),
    ]);
    if (a.error || b.error) setError(describe(a.error ?? b.error));
    else {
      setFoods(a.data as Food[]);
      setPublished(
        (b.data as PlanItem[]).map(({ date, meal, food_id }) => ({ date, meal, food_id })),
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attempt = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(describe(e));
      return false;
    }
  }, []);

  const check = useMemo(() => (draft ? checkPlan(foods, draft.days, draft.items) : null), [draft, foods]);

  const edit = (fn: (items: PlanItem[]) => PlanItem[]) =>
    setDraft((d) => (d ? { ...d, items: fn(d.items), note: null } : d));

  const value: Ctx = {
    foods,
    published,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    saveFood: (id, input) =>
      attempt(async () => {
        if (id) {
          const { data, error: err } = await supabase.from("foods").update(input).eq("id", id).select().single();
          if (err) throw err;
          setFoods((p) => p.map((f) => (f.id === id ? (data as Food) : f)));
        } else {
          const { data, error: err } = await supabase.from("foods").insert(input).select().single();
          if (err) throw err;
          setFoods((p) => [...p, data as Food]);
        }
      }),
    deleteFood: (id) =>
      attempt(async () => {
        const { error: err } = await supabase.from("foods").delete().eq("id", id);
        if (err) throw err;
        setFoods((p) => p.filter((f) => f.id !== id));
        setDraft((d) => (d ? { ...d, items: d.items.filter((i) => i.food_id !== id), note: null } : d));
      }),
    draft,
    check,
    makePlan: (days) => setDraft({ days, items: generatePlan(foods, days, 1).items, seed: 1, note: null }),
    setDraft,
    shuffle: () =>
      setDraft((d) => {
        if (!d) return d;
        const seed = d.seed + 1;
        return { ...d, seed, items: generatePlan(foods, d.days, seed).items, note: null };
      }),
    changeItem: (index, foodId) => edit((items) => items.map((it, i) => (i === index ? { ...it, food_id: foodId } : it))),
    removeItem: (index) => edit((items) => items.filter((_, i) => i !== index)),
    addItem: (date, meal, foodId) => edit((items) => [...items, { date, meal, food_id: foodId }]),
    publish: () =>
      attempt(async () => {
        if (!draft || !draft.items.length) throw new Error("There is nothing to publish.");
        const dates = draft.days.map((d) => d.date).sort();
        const from = dates[0];
        const to = dates[dates.length - 1];

        // Publishing again replaces the meal tasks for the same days, so nothing doubles up.
        const clear = await supabase.from("tasks").delete().eq("source", "meal_plan").gte("start_date", from).lte("start_date", to);
        if (clear.error) throw clear.error;
        const old = await supabase.from("meal_plans").delete().eq("week_start", startOfWeek(from));
        if (old.error) throw old.error;

        const plan = await supabase
          .from("meal_plans")
          .insert({ week_start: startOfWeek(from), status: "published" })
          .select()
          .single();
        if (plan.error) throw plan.error;
        const planId = (plan.data as { id: string }).id;

        const rows = draft.items.map((i) => ({ plan_id: planId, date: i.date, meal: i.meal, food_id: i.food_id }));
        const ins = await supabase.from("meal_plan_items").insert(rows);
        if (ins.error) throw ins.error;

        const name = (id: string) => foods.find((f) => f.id === id)?.name ?? "Meal";
        const jobs: NewTask[] = [];
        for (const d of draft.days) {
          for (const meal of MEALS) {
            const names = draft.items.filter((i) => i.date === d.date && i.meal === meal).map((i) => name(i.food_id));
            if (!names.length) continue;
            jobs.push({
              title: `${MEAL_LABEL[meal]}: ${names.join(" + ")}`,
              category: "routine",
              time: MEAL_TIME[meal],
              start_date: d.date,
              recurrence: { type: "once" },
              add_to_gcal: false,
              gcal_event_id: null,
              source: "meal_plan",
              source_ref: planId,
              target: null,
            });
          }
        }
        const made = await supabase.from("tasks").insert(jobs);
        if (made.error) throw made.error;

        await tasks.reload();
        setPublished((p) => [...p.filter((i) => i.date < from || i.date > to), ...draft.items]);
        setDraft(null);
      }),
  };

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

export function useKitchen() {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error("useKitchen must be used inside KitchenProvider");
  return ctx;
}
