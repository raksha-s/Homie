import { formatDay, formatMonthYear, monthGrid, parseISO, type ISODate } from "../../lib/dates";
import Dots from "./Dots";
import Ring from "./Ring";
import { describeDay, type DayStats } from "./dayStats";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Every day of `anchor`'s month, in order. */
export function daysOfMonth(anchor: ISODate): ISODate[] {
  const { m } = parseISO(anchor);
  return monthGrid(anchor).filter((d) => parseISO(d).m === m);
}

export default function MonthGrid({
  anchor,
  today,
  selected,
  statsFor,
  onSelect,
}: {
  anchor: ISODate;
  today: ISODate;
  selected: ISODate;
  statsFor: (d: ISODate) => DayStats;
  onSelect: (d: ISODate) => void;
}) {
  const grid = monthGrid(anchor);
  const month = parseISO(anchor).m;
  // Drop a trailing week that is entirely the next month.
  const days = parseISO(grid[35]).m === month ? grid : grid.slice(0, 35);
  return (
    <div role="grid" aria-label={formatMonthYear(anchor)} className="rounded-[var(--radius-card)] border border-line bg-surface p-2">
      <div role="row" className="mb-1 grid grid-cols-7">
        {LETTERS.map((l, i) => (
          <span key={i} role="columnheader" aria-label={WEEKDAY_SHORT[i]} className="py-1 text-center text-xs font-medium text-muted">
            {l}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const s = statsFor(d);
          const inMonth = parseISO(d).m === month;
          const isToday = d === today;
          const isSel = d === selected;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={describeDay(`${formatDay(d)}${isToday ? ", today" : ""}`, s, d > today)}
              onClick={() => onSelect(d)}
              className={`pressable flex min-h-[62px] flex-col items-center gap-1 rounded-xl py-1 ${
                isSel ? "bg-sunken" : ""
              } ${inMonth ? "" : "opacity-45"}`}
            >
              <Ring percent={s.percent} dim={!isSel}>
                <span
                  className={`grid size-[28px] place-items-center rounded-full text-sm ${
                    isToday ? "bg-accent font-medium text-on-accent" : isSel ? "font-bold" : "font-medium"
                  }`}
                >
                  {parseISO(d).d}
                </span>
              </Ring>
              <Dots categories={s.categories} size={6} />
            </button>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  const items: { key: "routine" | "reminder" | "restock" | "birthday" | "goal"; label: string }[] = [
    { key: "routine", label: "Routine" },
    { key: "reminder", label: "Reminder" },
    { key: "restock", label: "Shopping List" },
    { key: "birthday", label: "Birthday" },
    { key: "goal", label: "Goal" },
  ];
  return (
    <ul aria-label="Dot colours" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-1 pt-2 text-xs text-muted">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <span className={`dot dot-${i.key}`} style={{ width: 8, height: 8 }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
