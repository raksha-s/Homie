import { useEffect, useId, useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import { useKitchen, type FoodInput } from "./KitchenProvider";
import { MEALS, MEAL_LABEL, PREFERENCES, type Food, type FoodType, type Meal, type Preference } from "./types";

const TYPES: { key: FoodType; label: string }[] = [
  { key: "dish", label: "Dish" },
  { key: "fruit", label: "Fruit" },
  { key: "snack", label: "Snack" },
];

/** Add a dish, fruit or snack. `food` set means editing it. */
export default function FoodSheet({ open, food, onClose }: { open: boolean; food: Food | null; onClose: () => void }) {
  const k = useKitchen();
  const uid = useId();
  const [type, setType] = useState<FoodType>("dish");
  const [name, setName] = useState("");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [heavy, setHeavy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(food?.type ?? "dish");
    setName(food?.name ?? "");
    setMeals(food?.meals ?? []);
    setPrefs((food?.preferences ?? []).filter((p) => p !== "heavy"));
    setHeavy(food?.preferences.includes("heavy") ?? false);
    setError(null);
    setConfirming(false);
  }, [open, food]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async () => {
    const n = name.trim();
    if (!n) return setError("Give it a name.");
    if (type === "dish" && !meals.length) return setError("Pick at least one meal it can be eaten at.");
    if (k.foods.some((f) => f.id !== food?.id && f.name.toLowerCase() === n.toLowerCase()))
      return setError("You already have something with that name.");
    const input: FoodInput =
      type === "dish"
        ? { type, name: n, meals: MEALS.filter((m) => meals.includes(m)), preferences: heavy ? [...prefs, "heavy"] : prefs }
        : { type, name: n, meals: [], preferences: [] };
    setBusy(true);
    const ok = await k.saveFood(food?.id ?? null, input);
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!food) return;
    setBusy(true);
    const ok = await k.deleteFood(food.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={food ? "Edit food" : "Add a food"}
      description={confirming && food ? `Delete ${food.name}? It will also leave any plan you are reviewing.` : undefined}
    >
      {confirming ? (
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={() => setConfirming(false)}>
            Keep it
          </button>
          <button type="button" disabled={busy} className="btn-danger flex-1" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">What is it?</legend>
            <div className="flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1">
              {TYPES.map((t) => (
                <label
                  key={t.key}
                  className={`pressable flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] text-sm font-medium ${
                    type === t.key ? "bg-surface text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  <input type="radio" name={`${uid}-type`} className="sr-only" checked={type === t.key} onChange={() => setType(t.key)} />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${uid}-name`} className="mb-2 block text-sm font-medium">
              {type === "dish" ? "Dish name" : type === "fruit" ? "Fruit" : "Snack"}
            </label>
            <input
              id={`${uid}-name`}
              className="input"
              value={name}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => (setName(e.target.value), setError(null))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-err` : undefined}
            />
            {error ? (
              <p id={`${uid}-err`} role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>

          {type === "dish" ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">When can I eat this?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {MEALS.map((m) => (
                    <label key={m} className="flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] border border-line px-3">
                      <input type="checkbox" className="check" checked={meals.includes(m)} onChange={() => setMeals(toggle(meals, m))} />
                      {MEAL_LABEL[m]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">How heavy is it?</legend>
                <div className="flex flex-col gap-2">
                  <label className="flex min-h-11 items-start gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2">
                    <input type="radio" name={`${uid}-heavy`} className="check mt-0.5" checked={!heavy} onChange={() => setHeavy(false)} />
                    <span>
                      Light
                      <span className="block text-sm text-muted">Easy to eat. Can be on two days in a row.</span>
                    </span>
                  </label>
                  <label className="flex min-h-11 items-start gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2">
                    <input type="radio" name={`${uid}-heavy`} className="check mt-0.5" checked={heavy} onChange={() => setHeavy(true)} />
                    <span>
                      Heavy
                      <span className="block text-sm text-muted">Never on back-to-back days.</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Preference</legend>
                <div className="flex flex-col gap-2">
                  {PREFERENCES.map((p) => (
                    <label key={p.key} className="flex min-h-11 items-start gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2">
                      <input
                        type="checkbox"
                        className="check mt-0.5"
                        checked={prefs.includes(p.key)}
                        onChange={() => setPrefs(toggle(prefs, p.key))}
                      />
                      <span>
                        {p.label}
                        <span className="block text-sm text-muted">{p.help}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <p className="text-sm text-muted">
              {type === "fruit" ? "Homie puts a fruit on every day." : "Homie adds a snack like this to a meal now and then."}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : food ? "Save" : "Add"}
          </button>
          {food ? (
            <button type="button" className="min-h-11 font-medium text-danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          ) : null}
        </form>
      )}
    </BottomSheet>
  );
}
