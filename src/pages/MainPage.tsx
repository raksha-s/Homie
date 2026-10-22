import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import BottomSheet from "../components/BottomSheet";
import PageHeader from "../components/PageHeader";
import GoogleSyncButton from "../features/calendar/GoogleSyncButton";
import MonthGrid, { daysOfMonth } from "../features/calendar/MonthGrid";
import WeekStrip from "../features/calendar/WeekStrip";
import YearGrid from "../features/calendar/YearGrid";
import { useDayStats } from "../features/calendar/useDayStats";
import TaskBoard from "../features/tasks/TaskBoard";
import { useTasks } from "../features/tasks/TasksProvider";
import {
  addDays,
  addMonths,
  formatMonthYear,
  monthGrid,
  monthStart,
  parseISO,
  startOfWeek,
  todayISO,
  type ISODate,
} from "../lib/dates";

type View = "week" | "month" | "year";
const VIEWS: { key: View; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Main: one page with a week, a month and a year view. The task list always sits under the calendar. */
export default function MainPage() {
  const t = useTasks();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const statsFor = useDayStats();

  const view: View = VIEWS.find((v) => v.key === params.get("view"))?.key ?? "week";
  const rawOn = params.get("on") ?? "";
  const anchor: ISODate = ISO.test(rawOn) ? rawOn : today;
  // In the month view, the day the list scrolls to.
  const [selected, setSelected] = useState<ISODate>(anchor);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const go = (v: View, d: ISODate) => setParams({ view: v, ...(d !== today ? { on: d } : {}) }, { replace: true });
  const setView = (v: View) => go(v, anchor);
  const setAnchor = (d: ISODate) => {
    setSelected(d);
    go(view, d);
  };

  // The days this view needs done/skipped marks for.
  const [from, to] = useMemo<[ISODate, ISODate]>(() => {
    if (view === "week") return [startOfWeek(anchor), addDays(startOfWeek(anchor), 6)];
    if (view === "month") {
      const g = monthGrid(anchor);
      return [g[0], g[41]];
    }
    const y = parseISO(anchor).y;
    return [`${y}-01-01`, `${y}-12-31`];
  }, [view, anchor]);

  useEffect(() => {
    void t.ensureRange(from, to);
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (dir: -1 | 1) => {
    if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else if (view === "month") {
      const next = addMonths(anchor, dir);
      setAnchor(monthStart(next) === monthStart(today) ? today : next);
    } else setAnchor(addMonths(anchor, 12 * dir));
  };

  const title = view === "year" ? String(parseISO(anchor).y) : formatMonthYear(anchor);
  const isCurrent =
    view === "week"
      ? anchor === today
      : view === "month"
        ? monthStart(anchor) === monthStart(today)
        : parseISO(anchor).y === parseISO(today).y;
  const unit = view === "week" ? "week" : view === "month" ? "month" : "year";

  // What the list below shows: the day, the whole month, or the chosen month.
  const listDays = useMemo(
    () => (view === "week" ? [anchor] : daysOfMonth(anchor)),
    [view, anchor],
  );
  const addDate: ISODate =
    view === "week" ? anchor : view === "month" ? selected : monthStart(anchor) === monthStart(today) ? today : monthStart(anchor);

  /** Bring part of the list into view once it has updated. */
  const scrollTo = (id: string) =>
    window.setTimeout(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, 60);

  const pickDay = (d: ISODate) => {
    setAnchor(d);
    scrollTo(`day-${d}`);
  };
  const pickMonth = (d: ISODate) => {
    setAnchor(d);
    scrollTo("task-list");
  };

  return (
    <>
      <PageHeader title="Homie" actions={<GoogleSyncButton notify={setNotice} />} />

      <div role="group" aria-label="Calendar view" className="mb-3 flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
            className={`pressable min-h-11 flex-1 rounded-[10px] text-sm font-medium ${
              view === v.key ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={`${title}. Choose a date`}
          className="pressable -ml-2 flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] px-2 text-xl font-semibold tracking-tight"
        >
          {title}
          <CaretDown size={16} weight="bold" aria-hidden="true" className="text-muted" />
        </button>
        <span className="flex-1" />
        {!isCurrent ? (
          <button type="button" onClick={() => setAnchor(today)} className="btn-secondary !min-h-10 !px-4 text-sm">
            Today
          </button>
        ) : null}
        <button type="button" aria-label={`Previous ${unit}`} onClick={() => step(-1)} className="pressable grid size-11 place-items-center rounded-full text-muted">
          <CaretLeft size={20} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Next ${unit}`} onClick={() => step(1)} className="pressable -mr-2 grid size-11 place-items-center rounded-full text-muted">
          <CaretRight size={20} aria-hidden="true" />
        </button>
      </div>

      {t.loading ? (
        <div aria-busy="true" className="h-72 animate-pulse rounded-[var(--radius-card)] bg-sunken motion-reduce:animate-none" />
      ) : view === "week" ? (
        <WeekStrip selected={anchor} today={today} statsFor={statsFor} onSelect={setAnchor} onStep={step} />
      ) : view === "month" ? (
        <MonthGrid anchor={anchor} today={today} selected={selected} statsFor={statsFor} onSelect={pickDay} />
      ) : (
        <YearGrid anchor={anchor} today={today} statsFor={statsFor} onSelect={pickMonth} />
      )}

      <TaskBoard
        days={listDays}
        addDate={addDate}
        selected={view === "month" ? selected : undefined}
        emptyTitle={view === "week" ? (anchor === today ? "Nothing planned yet" : "Nothing planned for this day") : "Nothing planned this month"}
        notify={setNotice}
      />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4" style={{ bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 84px)" }}>
        {notice ? <p className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">{notice}</p> : null}
      </div>

      <BottomSheet open={picking} onOpenChange={setPicking} title="Go to a date">
        <div>
          <label htmlFor="jump-date" className="mb-2 block text-sm font-medium">
            Date
          </label>
          <input
            id="jump-date"
            type="date"
            className="input"
            value={anchor}
            onChange={(e) => {
              if (e.target.value) {
                setAnchor(e.target.value);
                setPicking(false);
              }
            }}
          />
        </div>
      </BottomSheet>
    </>
  );
}
