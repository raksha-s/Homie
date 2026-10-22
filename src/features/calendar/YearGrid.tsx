import { monthGrid, monthLong, monthStart, parseISO, type ISODate } from "../../lib/dates";
import Ring from "./Ring";
import type { DayStats } from "./dayStats";

/** Twelve small months. Tap one to list its tasks below. */
export default function YearGrid({
  anchor,
  today,
  statsFor,
  onSelect,
}: {
  anchor: ISODate;
  today: ISODate;
  statsFor: (d: ISODate) => DayStats;
  onSelect: (day: ISODate) => void;
}) {
  const y = parseISO(anchor).y;
  const chosen = monthStart(anchor);
  return (
    <ul className="grid grid-cols-2 gap-3">
      {Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}-01`).map((first) => {
        const grid = monthGrid(first);
        const m = parseISO(first).m;
        let total = 0;
        let done = 0;
        for (const d of grid) {
          if (parseISO(d).m !== m) continue;
          if (d > today) continue;
          const s = statsFor(d);
          total += s.total;
          done += s.done;
        }
        const pct = total ? Math.round((done / total) * 100) : null;
        const isNow = monthStart(today) === first;
        const isChosen = chosen === first;
        return (
          <li key={first}>
            <button
              type="button"
              aria-pressed={isChosen}
              onClick={() => onSelect(isNow ? today : first)}
              aria-label={`${monthLong(m)} ${y}${total ? `, ${pct} percent of ${total} tasks done so far` : ""}`}
              className={`pressable block w-full rounded-[var(--radius-card)] border p-3 text-left ${
                isChosen ? "border-accent bg-surface shadow-[var(--shadow)]" : "border-line bg-surface opacity-80"
              }`}
            >
              <span className="mb-2 flex items-center justify-between">
                <span className={`font-semibold ${isNow ? "text-accent-strong" : ""}`}>{monthLong(m)}</span>
                <Ring percent={pct} size={20} stroke={3} dim={!isChosen} />
              </span>
              <span className="grid grid-cols-7 gap-px text-center text-[10px] leading-[14px]" aria-hidden="true">
                {grid.slice(0, parseISO(grid[35]).m === m ? 42 : 35).map((d) => {
                  const inMonth = parseISO(d).m === m;
                  const has = inMonth && statsFor(d).total > 0;
                  return (
                    <span key={d} className={`relative ${inMonth ? "" : "opacity-0"} ${d === today ? "font-bold text-accent-strong" : "text-muted"}`}>
                      {parseISO(d).d}
                      {has ? <span className="absolute inset-x-0 -bottom-px mx-auto block size-[3px] rounded-full bg-accent" /> : null}
                    </span>
                  );
                })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
