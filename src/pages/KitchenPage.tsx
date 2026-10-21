import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Fab from "../components/Fab";
import SubTabs from "../components/SubTabs";
import { formatDay } from "../lib/dates";
import { useKitchen } from "../features/kitchen/KitchenProvider";
import FoodSheet from "../features/kitchen/FoodSheet";
import MealPicker from "../features/kitchen/MealPicker";
import PlanReview from "../features/kitchen/PlanReview";
import { planWindow } from "../features/kitchen/window";
import { MEALS, MEAL_LABEL, PREFERENCES, type Food, type PlanItem } from "../features/kitchen/types";

const kitchenTabs = [
  { to: "/kitchen/plan", label: "Meal plan" },
  { to: "/kitchen/foods", label: "My foods" },
];

export default function KitchenPage({ tab }: { tab: "plan" | "foods" }) {
  const k = useKitchen();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  return (
    <>
      <PageHeader title="Kitchen" />
      <SubTabs tabs={kitchenTabs} label="Kitchen sections" />

      {k.error ? (
        <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-sunken px-4 py-3 text-sm text-danger">
          {k.error}{" "}
          <button type="button" className="font-semibold underline" onClick={() => void k.reload()}>
            Try again
          </button>{" "}
          <button type="button" className="font-semibold underline" onClick={k.clearError}>
            Dismiss
          </button>
        </p>
      ) : null}

      {k.loading ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-[var(--radius-card)] bg-sunken motion-reduce:animate-none" />
          ))}
        </div>
      ) : tab === "foods" ? (
        <FoodsTab />
      ) : (
        <PlanTab onPublished={() => setNotice("Plan published. Your meals are on My Tasks.")} />
      )}

      {notice ? (
        <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4" style={{ bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 84px)" }} role="status">
          <p className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">{notice}</p>
        </div>
      ) : null}
    </>
  );
}

function FoodsTab() {
  const k = useKitchen();
  const [sheet, setSheet] = useState<{ food: Food | null } | null>(null);
  const groups: { title: string; list: Food[] }[] = [
    { title: "Dishes", list: k.foods.filter((f) => f.type === "dish") },
    { title: "Fruits", list: k.foods.filter((f) => f.type === "fruit") },
    { title: "Snacks", list: k.foods.filter((f) => f.type === "snack") },
  ];

  return (
    <>
      {k.foods.length === 0 ? (
        <EmptyState title="No foods yet">
          Add the dishes you can make, and the fruits and snacks you like. Then Homie can plan your week.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups
            .filter((g) => g.list.length)
            .map((g) => (
              <section key={g.title} aria-labelledby={`g-${g.title}`}>
                <h2 id={`g-${g.title}`} className="mb-2 text-sm font-semibold text-muted">
                  {g.title}
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.list.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSheet({ food: f })}
                        className="pressable w-full rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left"
                        aria-label={`Edit ${f.name}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 break-words font-medium">{f.name}</span>
                          {f.preferences.includes("heavy") ? <span className="badge badge-reminder shrink-0">Heavy</span> : null}
                        </span>
                        {f.type === "dish" ? (
                          <span className="mt-1 block text-sm text-muted">
                            {MEALS.filter((m) => f.meals.includes(m)).map((m) => MEAL_LABEL[m]).join(", ")}
                            {f.preferences.filter((p) => p !== "heavy").length
                              ? ` · ${f.preferences
                                  .filter((p) => p !== "heavy")
                                  .map((p) => PREFERENCES.find((x) => x.key === p)?.label)
                                  .filter(Boolean)
                                  .join("; ")}`
                              : ""}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      <Fab label="Add food" onClick={() => setSheet({ food: null })} />
      <FoodSheet open={Boolean(sheet)} food={sheet?.food ?? null} onClose={() => setSheet(null)} />
    </>
  );
}

function PlanTab({ onPublished }: { onPublished: () => void }) {
  const k = useKitchen();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const win = useMemo(() => (picking ? planWindow() : null), [picking]);

  if (k.foods.filter((f) => f.type === "dish").length === 0 && !k.draft) {
    return (
      <EmptyState title="Add some foods first">
        Homie plans from your own list. Add a few dishes in My foods, then come back to make a plan.
      </EmptyState>
    );
  }

  if (k.draft) {
    return (
      <PlanReview
        busy={busy}
        onPublish={async () => {
          setBusy(true);
          const ok = await k.publish();
          setBusy(false);
          if (ok) onPublished();
        }}
      />
    );
  }

  return (
    <>
      <button type="button" className="btn-primary w-full" onClick={() => setPicking(true)}>
        Make meal plan
      </button>
      <p className="mt-2 text-sm text-muted">Runs in the app, so it costs nothing. You review it before it goes to My Tasks.</p>

      <PublishedPlan items={k.published} foods={k.foods} />

      <MealPicker
        open={picking}
        initial={win?.days ?? []}
        onClose={() => setPicking(false)}
        onGenerate={(days) => {
          k.makePlan(days);
          setPicking(false);
        }}
      />
    </>
  );
}

function PublishedPlan({ items, foods }: { items: PlanItem[]; foods: Food[] }) {
  const byDate = useMemo(() => {
    const m = new Map<string, PlanItem[]>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);
  if (!byDate.length) return null;
  const name = (id: string) => foods.find((f) => f.id === id)?.name ?? "Removed food";
  return (
    <section aria-labelledby="published" className="mt-6">
      <h2 id="published" className="mb-2 text-lg font-semibold">
        Your published plan
      </h2>
      <ul className="flex flex-col gap-3">
        {byDate.map(([date, list]) => (
          <li key={date} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <h3 className="font-semibold">{formatDay(date)}</h3>
            <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
              {MEALS.filter((m) => list.some((i) => i.meal === m)).map((m) => (
                <div key={m} className="contents">
                  <dt className="text-muted">{MEAL_LABEL[m]}</dt>
                  <dd>{list.filter((i) => i.meal === m).map((i) => name(i.food_id)).join(" + ")}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
