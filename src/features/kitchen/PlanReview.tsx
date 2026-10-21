import { Plus, Shuffle, Trash } from "@phosphor-icons/react";
import { formatDay } from "../../lib/dates";
import { useKitchen } from "./KitchenProvider";
import { MEALS, MEAL_LABEL, type Food, type Meal } from "./types";

/** The draft plan: change any item from your own list, then publish. */
export default function PlanReview({ onPublish, busy }: { onPublish: () => void; busy: boolean }) {
  const k = useKitchen();
  const draft = k.draft!;
  const warnings = [...(k.check?.hard ?? []), ...(k.check?.soft ?? [])];

  const optionsFor = (meal: Meal): { dishes: Food[]; fruits: Food[]; snacks: Food[] } => ({
    dishes: k.foods.filter((f) => f.type === "dish" && (f.meals.includes(meal) || f.preferences.includes("daily"))),
    fruits: k.foods.filter((f) => f.type === "fruit"),
    snacks: k.foods.filter((f) => f.type === "snack"),
  });

  return (
    <section aria-labelledby="review-title">
      <h2 id="review-title" className="text-lg font-semibold">
        Review your plan
      </h2>
      <p className="mt-1 text-sm text-muted">Change anything from your own list. Nothing reaches My Tasks until you publish.</p>

      {draft.note ? <p className="mt-3 rounded-[var(--radius-control)] bg-sunken px-4 py-3 text-sm">{draft.note}</p> : null}

      {warnings.length ? (
        <div role="status" className="mt-3 rounded-[var(--radius-control)] bg-sunken px-4 py-3 text-sm">
          <p className="font-medium">Worth a look</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex gap-3">
        <button type="button" className="btn-secondary inline-flex flex-1 items-center justify-center gap-2" onClick={() => void k.shuffle()} disabled={k.planning}>
          <Shuffle size={18} aria-hidden="true" />
          {k.planning ? "Planning…" : "Shuffle"}
        </button>
        <button type="button" disabled={busy || !draft.items.length} className="btn-primary flex-1" onClick={onPublish}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      </div>
      <button type="button" className="mt-2 min-h-11 w-full text-sm font-medium text-muted" onClick={() => k.setDraft(null)}>
        Discard this plan
      </button>

      <ul className="mt-4 flex flex-col gap-3">
        {draft.days.map((d) => (
          <li key={d.date} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <h3 className="font-semibold">{formatDay(d.date)}</h3>
            <div className="mt-2 flex flex-col gap-3">
              {MEALS.filter((m) => d.meals.includes(m)).map((meal) => {
                const mine = draft.items.map((it, index) => ({ it, index })).filter((x) => x.it.date === d.date && x.it.meal === meal);
                const opts = optionsFor(meal);
                return (
                  <div key={meal}>
                    <p className="text-sm font-medium text-muted">{MEAL_LABEL[meal]}</p>
                    <div className="mt-1 flex flex-col gap-2">
                      {mine.map(({ it, index }, n) => (
                        <div key={index} className="flex items-center gap-2">
                          <select
                            className="input"
                            aria-label={`${MEAL_LABEL[meal]} on ${formatDay(d.date)}, item ${n + 1}`}
                            value={it.food_id}
                            onChange={(e) => k.changeItem(index, e.target.value)}
                          >
                            <FoodOptions opts={opts} current={it.food_id} foods={k.foods} />
                          </select>
                          <button
                            type="button"
                            aria-label={`Remove from ${MEAL_LABEL[meal].toLowerCase()} on ${formatDay(d.date)}`}
                            className="pressable grid size-11 shrink-0 place-items-center rounded-full text-muted"
                            onClick={() => k.removeItem(index)}
                          >
                            <Trash size={20} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      {mine.length === 0 ? <p className="text-sm text-muted">Nothing planned.</p> : null}
                      <AddToMeal meal={meal} date={d.date} opts={opts} />
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FoodOptions({
  opts,
  current,
  foods,
}: {
  opts: { dishes: Food[]; fruits: Food[]; snacks: Food[] };
  current: string;
  foods: Food[];
}) {
  const known = [...opts.dishes, ...opts.fruits, ...opts.snacks].some((f) => f.id === current);
  const cur = foods.find((f) => f.id === current);
  return (
    <>
      {!known && cur ? <option value={cur.id}>{cur.name}</option> : null}
      {opts.dishes.length ? (
        <optgroup label="Dishes">
          {opts.dishes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {opts.fruits.length ? (
        <optgroup label="Fruits">
          {opts.fruits.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {opts.snacks.length ? (
        <optgroup label="Snacks">
          {opts.snacks.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}

function AddToMeal({ meal, date, opts }: { meal: Meal; date: string; opts: { dishes: Food[]; fruits: Food[]; snacks: Food[] } }) {
  const k = useKitchen();
  const first = opts.dishes[0] ?? opts.fruits[0] ?? opts.snacks[0];
  if (!first) return null;
  return (
    <button
      type="button"
      className="pressable inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-2 text-sm font-medium text-accent-strong"
      onClick={() => k.addItem(date, meal, first.id)}
    >
      <Plus size={16} aria-hidden="true" />
      Add to {MEAL_LABEL[meal].toLowerCase()}
    </button>
  );
}
