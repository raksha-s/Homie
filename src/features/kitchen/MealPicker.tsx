import { useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import { formatDay } from "../../lib/dates";
import { MEALS, MEAL_LABEL, type DayRequest, type Meal } from "./types";

const SHORT: Record<Meal, string> = { breakfast: "Bfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };

/** "Before generating, ask me which meals I need on each day." One tick per meal per day. */
export default function MealPicker({
  open,
  initial,
  onClose,
  onGenerate,
}: {
  open: boolean;
  initial: DayRequest[];
  onClose: () => void;
  onGenerate: (days: DayRequest[]) => void;
}) {
  const [days, setDays] = useState<DayRequest[]>(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setDays(initial);
  }

  const toggle = (date: string, meal: Meal) =>
    setDays((ds) =>
      ds.map((d) => (d.date === date ? { ...d, meals: d.meals.includes(meal) ? d.meals.filter((m) => m !== meal) : [...d.meals, meal] } : d)),
    );
  const chosen = days.filter((d) => d.meals.length);
  const offered = (date: string, meal: Meal) => initial.find((d) => d.date === date)?.meals.includes(meal) ?? false;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Which meals do you need?"
      description="Untick any meal you will skip. The plan runs to Saturday night."
    >
      <div className="max-h-[52dvh] overflow-y-auto">
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="pb-1 font-medium">
                Day
              </th>
              {MEALS.map((m) => (
                <th key={m} scope="col" className="w-14 pb-1 text-center font-medium">
                  <abbr title={MEAL_LABEL[m]} className="text-xs no-underline">
                    {SHORT[m]}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row" className="pr-2 text-left font-medium">
                  {formatDay(d.date)}
                </th>
                {MEALS.map((m) => (
                  <td key={m} className="text-center">
                    {offered(d.date, m) ? (
                      <label className="grid min-h-11 place-items-center">
                        <input
                          type="checkbox"
                          className="check"
                          checked={d.meals.includes(m)}
                          onChange={() => toggle(d.date, m)}
                          aria-label={`${MEAL_LABEL[m]} on ${formatDay(d.date)}`}
                        />
                      </label>
                    ) : (
                      <span className="text-muted" aria-label={`${MEAL_LABEL[m]} on ${formatDay(d.date)} has passed`}>
                        –
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" disabled={!chosen.length} className="btn-primary mt-4 w-full" onClick={() => onGenerate(chosen)}>
        Make meal plan
      </button>
    </BottomSheet>
  );
}
