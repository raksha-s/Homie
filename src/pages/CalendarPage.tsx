import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowsClockwise, CaretLeft, CaretRight } from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import SubTabs from "../components/SubTabs";
import DayTasks from "../features/calendar/DayTasks";
import Dots from "../features/calendar/Dots";
import Ring from "../features/calendar/Ring";
import { describeDay, type DayStats } from "../features/calendar/dayStats";
import { useDayStats } from "../features/calendar/useDayStats";
import { useTasks, type TaskInstance } from "../features/tasks/TasksProvider";
import {
  addDays,
  addMonths,
  formatDay,
  formatMonthYear,
  formatWeekRange,
  monthGrid,
  monthLong,
  monthStart,
  parseISO,
  startOfWeek,
  todayISO,
  weekday,
  type ISODate,
} from "../lib/dates";
import { googleConfigured } from "../lib/google";
import { mainTabs } from "./TasksPage";

type View = "week" | "month" | "year";
const VIEWS: { key: View; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];
const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const t = useTasks();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const statsFor = useDayStats();

  const view: View = (VIEWS.find((v) => v.key === params.get("view"))?.key ?? "month") as View;
  const rawOn = params.get("on") ?? "";
  const anchor: ISODate = /^\d{4}-\d{2}-\d{2}$/.test(rawOn) ? rawOn : today;
  const [selected, setSelected] = useState<ISODate>(anchor);

  const setView = (v: View) => setParams({ view: v, ...(anchor !== today ? { on: anchor } : {}) }, { replace: true });
  const setAnchor = (d: ISODate) => setParams({ view, ...(d !== today ? { on: d } : {}) }, { replace: true });

  // The span of days the current view needs, so their done/skipped marks can be loaded.
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

  const openInTasks = (d: ISODate) => nav(d === today ? "/main/tasks" : `/main/tasks?date=${d}`);
  const toggle = (i: TaskInstance) => void t.setStatus(i.task, i.date, i.status === "done" ? "pending" : "done");

  const step = (dir: -1 | 1) => {
    if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else if (view === "month") {
      const next = addMonths(anchor, dir);
      setAnchor(next);
      // Keep the chosen day inside the month on screen.
      setSelected(monthStart(next) === monthStart(today) ? today : next);
    } else setAnchor(addMonths(anchor, 12 * dir));
  };

  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const title =
    view === "week" ? formatWeekRange(anchor) : view === "month" ? formatMonthYear(anchor) : String(parseISO(anchor).y);
  const isCurrent =
    view === "week"
      ? startOfWeek(anchor) === startOfWeek(today)
      : view === "month"
        ? monthStart(anchor) === monthStart(today)
        : parseISO(anchor).y === parseISO(today).y;

  return (
    <>
      <PageHeader title="Homie" />
      <SubTabs tabs={mainTabs} label="Main sections" />

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

      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-label={`Previous ${view}`} onClick={() => step(-1)} className="pressable grid size-11 place-items-center rounded-full bg-sunken">
          <CaretLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center text-lg font-semibold" aria-live="polite">
          {title}
        </h2>
        {!isCurrent ? (
          <button type="button" onClick={goToday} className="btn-secondary !min-h-11 !px-4 text-sm">
            Today
          </button>
        ) : null}
        <button type="button" aria-label={`Next ${view}`} onClick={() => step(1)} className="pressable grid size-11 place-items-center rounded-full bg-sunken">
          <CaretRight size={20} aria-hidden="true" />
        </button>
      </div>

      {t.loading ? (
        <div aria-busy="true" className="h-72 animate-pulse rounded-[var(--radius-card)] bg-sunken motion-reduce:animate-none" />
      ) : view === "week" ? (
        <WeekView
          anchor={anchor}
          today={today}
          statsFor={statsFor}
          instancesOn={t.instancesOn}
          onToggle={toggle}
          openInTasks={openInTasks}
        />
      ) : view === "month" ? (
        <>
          <MonthView anchor={anchor} today={today} selected={selected} statsFor={statsFor} onSelect={setSelected} />
          <DayPanel
            date={selected}
            today={today}
            stats={statsFor(selected)}
            instances={t.instancesOn(selected)}
            onToggle={toggle}
            openInTasks={openInTasks}
          />
        </>
      ) : (
        <YearView anchor={anchor} today={today} statsFor={statsFor} openMonth={(m) => { setSelected(m); setParams({ view: "month", on: m }); }} />
      )}

      <Legend />
      {googleConfigured ? <GoogleSync /> : null}
    </>
  );
}

function MonthView({
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
    </div>
  );
}

/** The chosen day's tasks, under the month, with a tick on each. */
function DayPanel({
  date,
  today,
  stats,
  instances,
  onToggle,
  openInTasks,
}: {
  date: ISODate;
  today: ISODate;
  stats: DayStats;
  instances: TaskInstance[];
  onToggle: (i: TaskInstance) => void;
  openInTasks: (d: ISODate) => void;
}) {
  return (
    <section aria-labelledby="day-panel" className="mt-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="day-panel" className="font-semibold">
            {date === today ? "Today" : formatDay(date)}
          </h3>
          <p className="text-sm text-muted" aria-live="polite">
            {date === today ? `${formatDay(date)} · ` : ""}
            {stats.total ? `${stats.done} of ${stats.total} done` : "Nothing planned"}
          </p>
        </div>
        <button type="button" onClick={() => openInTasks(date)} className="btn-secondary !min-h-10 shrink-0 !px-3 text-sm">
          Open day
        </button>
      </div>
      {instances.length ? (
        <DayTasks instances={instances} onToggle={onToggle} />
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Nothing planned for this day. Open the day to add a task.
        </p>
      )}
    </section>
  );
}

function WeekView({
  anchor,
  today,
  statsFor,
  instancesOn,
  onToggle,
  openInTasks,
}: {
  anchor: ISODate;
  today: ISODate;
  statsFor: (d: ISODate) => DayStats;
  instancesOn: (d: ISODate) => TaskInstance[];
  onToggle: (i: TaskInstance) => void;
  openInTasks: (d: ISODate) => void;
}) {
  const start = startOfWeek(anchor);
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const s = statsFor(d);
        const instances = instancesOn(d);
        const isToday = d === today;
        return (
          <li
            key={d}
            className={`rounded-[var(--radius-card)] border bg-surface p-3 ${isToday ? "border-accent" : "border-line"}`}
          >
            <div className="flex items-center gap-3">
              <Ring percent={s.percent} size={44} dim={!isToday}>
                <span
                  className={`grid size-[32px] place-items-center rounded-full text-base ${
                    isToday ? "bg-accent font-semibold text-on-accent" : "font-medium"
                  }`}
                >
                  {parseISO(d).d}
                </span>
              </Ring>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{WEEKDAY_SHORT[weekday(d)]}</h3>
                <p className="text-sm text-muted">
                  {s.total ? `${s.done} of ${s.total} done` : "Nothing planned"}
                </p>
              </div>
              <Dots categories={s.categories} />
              <button
                type="button"
                aria-label={`Open ${formatDay(d)} in My Tasks`}
                onClick={() => openInTasks(d)}
                className="pressable grid size-11 shrink-0 place-items-center rounded-full text-muted"
              >
                <CaretRight size={18} aria-hidden="true" />
              </button>
            </div>
            {instances.length ? (
              <div className="mt-1">
                <DayTasks instances={instances} onToggle={onToggle} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function YearView({
  anchor,
  today,
  statsFor,
  openMonth,
}: {
  anchor: ISODate;
  today: ISODate;
  statsFor: (d: ISODate) => DayStats;
  openMonth: (firstOfMonth: ISODate) => void;
}) {
  const y = parseISO(anchor).y;
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
        return (
          <li key={first}>
            <button
              type="button"
              onClick={() => openMonth(isNow ? today : first)}
              aria-label={`${monthLong(m)} ${y}${total ? `, ${pct} percent of ${total} tasks done so far` : ""}`}
              className={`pressable block w-full rounded-[var(--radius-card)] border bg-surface p-3 text-left ${isNow ? "border-accent" : "border-line"}`}
            >
              <span className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{monthLong(m)}</span>
                <Ring percent={pct} size={20} stroke={3} />
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

function Legend() {
  const items: { key: "routine" | "reminder" | "restock" | "birthday" | "goal"; label: string }[] = [
    { key: "routine", label: "Routine" },
    { key: "reminder", label: "Reminder" },
    { key: "restock", label: "Shopping List" },
    { key: "birthday", label: "Birthday" },
    { key: "goal", label: "Goal" },
  ];
  return (
    <ul aria-label="Dot colours" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <span className={`dot dot-${i.key}`} style={{ width: 8, height: 8 }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function GoogleSync() {
  const t = useTasks();
  const [busy, setBusy] = useState(false);
  const last = t.lastImport;
  return (
    <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-4" aria-labelledby="gsync">
      <h2 id="gsync" className="font-semibold">
        Google Calendar
      </h2>
      <p className="mt-1 text-sm text-muted">
        Brings events from the next two weeks into Homie as Reminders, and birthdays as Birthdays. Events Homie sent to Google are not brought back, and nothing is imported twice.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await t.importFromGoogle();
          setBusy(false);
        }}
        className="btn-primary mt-3 inline-flex items-center gap-2"
      >
        <ArrowsClockwise size={18} aria-hidden="true" />
        {busy ? "Syncing" : "Sync from Google Calendar"}
      </button>
      {last ? (
        <p role="status" className="mt-3 text-sm">
          {last.count === 0 && last.converted === 0
            ? "Already up to date."
            : [
                last.count ? `Added ${last.count} ${last.count === 1 ? "event" : "events"}.` : "",
                last.converted ? `Turned ${last.converted} into ${last.converted === 1 ? "a birthday" : "birthdays"}.` : "",
              ]
                .filter(Boolean)
                .join(" ")}
          {last.addedSundayTask ? " A reminder every Sunday at 7:00 AM will now prompt you to sync." : ""}
        </p>
      ) : null}
      {t.actionError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {t.actionError}
        </p>
      ) : null}
    </section>
  );
}
