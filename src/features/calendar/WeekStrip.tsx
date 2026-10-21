import { useRef, type TouchEvent } from "react";
import { addDays, formatDay, parseISO, startOfWeek, type ISODate } from "../../lib/dates";
import Dots from "./Dots";
import { describeDay, type DayStats } from "./dayStats";
import Ring from "./Ring";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The week at the top of My Tasks: weekday, a ring of progress around the date, and a dot for the
 * kinds of task on that day. The chosen day sits on a raised card. Swipe sideways for another week.
 */
export default function WeekStrip({
  selected,
  today,
  statsFor,
  onSelect,
  onStep,
}: {
  selected: ISODate;
  today: ISODate;
  statsFor: (d: ISODate) => DayStats;
  onSelect: (d: ISODate) => void;
  onStep: (dir: -1 | 1) => void;
}) {
  const start = startOfWeek(selected);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 2) onStep(dx < 0 ? 1 : -1);
  };

  return (
    <div
      role="group"
      aria-label="Days of this week"
      className="grid grid-cols-7 gap-1"
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d, i) => {
        const s = statsFor(d);
        const isSel = d === selected;
        const isToday = d === today;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={isSel}
            aria-current={isToday ? "date" : undefined}
            aria-label={describeDay(`${formatDay(d)}${isToday ? ", today" : ""}`, s, d > today)}
            onClick={() => onSelect(d)}
            className={`pressable flex min-h-[84px] flex-col items-center gap-1 rounded-2xl px-0.5 py-2 ${
              isSel ? "bg-surface shadow-[var(--shadow)]" : ""
            }`}
          >
            <span className={`text-xs ${isSel ? "font-semibold text-ink" : "text-muted"}`}>
              {isToday ? "Today" : WEEKDAY_SHORT[i]}
            </span>
            <Ring percent={s.percent} size={44} dim={!isSel}>
              <span className="flex flex-col items-center leading-none">
                <Dots categories={s.categories.slice(0, 3)} size={5} />
                <span className={`mt-1 text-base tabular-nums ${isSel ? "font-bold text-ink" : "font-medium text-muted"}`}>
                  {parseISO(d).d}
                </span>
              </span>
            </Ring>
          </button>
        );
      })}
    </div>
  );
}
