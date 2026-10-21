import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowsClockwise, CaretLeft, CaretRight } from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import SubTabs from "../components/SubTabs";
import Dots from "../features/calendar/Dots";
import Ring from "../features/calendar/Ring";
import { dayStats, describeDay, type DayStats } from "../features/calendar/dayStats";
import { useTasks } from "../features/tasks/TasksProvider";
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

  const view: View = (VIEWS.find((v) => v.key === params.get("view"))?.key ?? "month") as View;
  const rawOn = params.get("on") ?? "";
  const anchor: ISODate = /^\d{4}-\d{2}-\d{2}$/.test(rawOn) ? rawOn : today;

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

  const statsFor = useMemo(() => {
    const cache = new Map<ISODate, DayStats>();
    return (d: ISODate) => {
      let s = cache.get(d);
      if (!s) {
        s = dayStats(t.instancesOn(d));
        cache.set(d, s);
      }
      return s;
    };
  }, [t.instancesOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDay = (d: ISODate) => nav(d === today ? "/main/tasks" : `/main/tasks?date=${d}`);

  const step = (dir: -1 | 1) => {
    if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else if (view === "month") setAnchor(addMonths(anchor, dir));
    else setAnchor(addMonths(anchor, 12 * dir));
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
          <button type="button" onClick={() => setAnchor(today)} className="btn-secondary !min-h-11 !px-4 text-sm">
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
        <WeekView anchor={anchor} today={today} statsFor={statsFor} openDay={openDay} instancesOn={t.instancesOn} />
      ) : view === "month" ? (
        <MonthView anchor={anchor} today={today} statsFor={statsFor} openDay={openDay} />
      ) : (
        <YearView anchor={anchor} today={today} statsFor={statsFor} openMonth={(m) => setParams({ view: "month", on: m })} />
      )}

      <Legend />
      {googleConfigured ? <GoogleSync /> : null}
    </>
  );
}

type ViewProps = {
  anchor: ISODate;
  today: ISODate;
  statsFor: (d: ISODate) => DayStats;
  openDay: (d: ISODate) => void;
};

function MonthView({ anchor, today, statsFor, openDay }: ViewProps) {
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
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-label={describeDay(`${formatDay(d)}${isToday ? ", today" : ""}`, s, d > today)}
              onClick={() => openDay(d)}
              className={`pressable flex min-h-[62px] flex-col items-center gap-1 rounded-xl py-1 ${inMonth ? "" : "opacity-45"}`}
            >
              <Ring percent={s.percent}>
                <span
                  className={`grid size-[28px] place-items-center rounded-full text-sm font-medium ${
                    isToday ? "bg-accent text-on-accent" : ""
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

function WeekView({
  anchor,
  today,
  statsFor,
  openDay,
  instancesOn,
}: ViewProps & { instancesOn: ReturnType<typeof useTasks>["instancesOn"] }) {
  const start = startOfWeek(anchor);
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const s = statsFor(d);
        const preview = instancesOn(d).filter((x) => x.status !== "skipped").slice(0, 3);
        const isToday = d === today;
        return (
          <li key={d}>
            <button
              type="button"
              onClick={() => openDay(d)}
              aria-label={describeDay(`${formatDay(d)}${isToday ? ", today" : ""}`, s, d > today)}
              className={`pressable flex w-full gap-3 rounded-[var(--radius-card)] border bg-surface p-3 text-left ${
                isToday ? "border-accent" : "border-line"
              }`}
            >
              <span className="flex w-11 shrink-0 flex-col items-center">
                <span className="text-xs font-medium text-muted">{WEEKDAY_SHORT[weekday(d)]}</span>
                <span className="mt-0.5">
                  <Ring percent={s.percent} size={40}>
                    <span
                      className={`grid size-[30px] place-items-center rounded-full text-base font-semibold ${
                        isToday ? "bg-accent text-on-accent" : ""
                      }`}
                    >
                      {parseISO(d).d}
                    </span>
                  </Ring>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm">
                  <Dots categories={s.categories} />
                  <span className="text-muted">
                    {s.total ? `${s.total} ${s.total === 1 ? "task" : "tasks"}${d > today ? " planned" : ` · ${s.percent}% done`}` : "Nothing planned"}
                  </span>
                </span>
                {preview.map((p) => (
                  <span key={p.task.id} className="mt-0.5 block truncate text-sm">
                    {p.task.title}
                  </span>
                ))}
                {s.total > preview.length ? <span className="mt-0.5 block text-sm text-muted">and {s.total - preview.length} more</span> : null}
              </span>
            </button>
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
}: Omit<ViewProps, "openDay"> & { openMonth: (firstOfMonth: ISODate) => void }) {
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
              onClick={() => openMonth(first)}
              aria-label={`${monthLong(m)} ${y}${total ? `, ${pct} percent of ${total} tasks done so far` : ""}`}
              className={`pressable block w-full rounded-[var(--radius-card)] border bg-surface p-3 text-left ${isNow ? "border-accent" : "border-line"}`}
            >
              <span className="mb-2 flex items-baseline justify-between">
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
    <ul aria-label="Dot colours" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <span className={`dot dot-${i.key}`} style={{ width: 8, height: 8 }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
      <li>A ring around a date means it has tasks. The coloured part is how much of that day was done, out of tasks not skipped, so days ahead show an empty ring.</li>
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
