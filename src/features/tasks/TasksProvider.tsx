import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { addDays, weekday, dayNumber, fromDayNumber, nowTime, normTime, todayISO, type ISODate } from "../../lib/dates";
import { googleConfigured, loadGoogle, requestGoogleToken } from "../../lib/google";
import { createEvent, deleteEvent, deleteInstance, eventToTask, isImportable, listEvents, updateEvent } from "./gcal";
import { occursOn } from "./recurrence";
import type { NewTask, Occurrence, OccurrenceStatus, Recurrence, Task } from "./types";

/** One task as it appears on one day. */
export type TaskInstance = {
  task: Task;
  date: ISODate;
  status: OccurrenceStatus;
  /** Effective time for this day: a one-day move wins over the task's own time. */
  time: string | null;
};

export type EditScope = "only" | "future";

type Ctx = {
  tasks: Task[];
  loading: boolean;
  loadError: string | null;
  actionError: string | null;
  clearActionError: () => void;
  reload: () => Promise<void>;
  ensureDay: (date: ISODate) => Promise<void>;
  /** Load done/skipped marks for every day in [from, to]. */
  ensureRange: (from: ISODate, to: ISODate) => Promise<void>;
  isDayLoaded: (date: ISODate) => boolean;
  instancesOn: (date: ISODate) => TaskInstance[];
  timeOn: (task: Task, date: ISODate) => string | null;
  dueReminders: TaskInstance[];
  silence: (inst: TaskInstance) => void;
  isSilenced: (inst: TaskInstance) => boolean;
  createTask: (input: NewTask) => Promise<boolean>;
  setStatus: (task: Task, date: ISODate, status: OccurrenceStatus) => Promise<boolean>;
  moveTime: (task: Task, date: ISODate, time: string) => Promise<boolean>;
  modifyTask: (task: Task, date: ISODate, scope: EditScope, next: NewTask) => Promise<boolean>;
  deleteTask: (task: Task, date: ISODate, scope: EditScope) => Promise<boolean>;
  /** Tasks ticked for Google Calendar that never reached it (for example when Google was not connected). */
  pendingGcal: Task[];
  syncPendingGcal: () => Promise<boolean>;
  /** Pull the next two weeks of Google Calendar events in as Reminders. */
  importFromGoogle: () => Promise<boolean>;
  lastImport: { count: number; at: string; addedSundayTask: boolean } | null;
};

const TasksContext = createContext<Ctx | null>(null);

const keyOf = (taskId: string, date: ISODate) => `${taskId}|${date}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
const rowToTask = (r: any): Task => ({ ...r, time: normTime(r.time) });
const rowToOcc = (r: any): Occurrence => ({ ...r, time_override: normTime(r.time_override) });

function describe(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [occ, setOcc] = useState<Map<string, Occurrence>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const loadedDays = useRef(new Set<ISODate>());
  const [lastImport, setLastImport] = useState<Ctx["lastImport"]>(null);
  const [, bump] = useState(0);

  const mergeOcc = useCallback((rows: Occurrence[]) => {
    setOcc((prev) => {
      const next = new Map(prev);
      for (const o of rows) next.set(keyOf(o.task_id, o.date), o);
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("tasks").select("*").order("created_at");
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const list = (data as any[]).map(rowToTask);
    setTasks(list);
    // A restock stays on the list until it is done, so its done date matters for every day.
    const restockIds = list.filter((t) => t.category === "restock").map((t) => t.id);
    if (restockIds.length) {
      const res = await supabase.from("task_occurrences").select("*").in("task_id", restockIds);
      if (res.error) setLoadError(res.error.message);
      else mergeOcc((res.data as any[]).map(rowToOcc));
    }
    setLoading(false);
  }, [mergeOcc]);

  useEffect(() => {
    if (userId) void reload();
  }, [userId, reload]);

  // Tick every 30 seconds so reminders turn "due" on time and the day rolls over at midnight.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    const onVisible = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const ensureDay = useCallback(
    async (date: ISODate) => {
      if (loadedDays.current.has(date)) return;
      const { data, error } = await supabase.from("task_occurrences").select("*").eq("date", date);
      if (error) {
        setLoadError(error.message);
        return;
      }
      loadedDays.current.add(date);
      mergeOcc((data as any[]).map(rowToOcc));
      bump((n) => n + 1);
    },
    [mergeOcc],
  );

  const ensureRange = useCallback(
    async (from: ISODate, to: ISODate) => {
      const missing: ISODate[] = [];
      for (let n = dayNumber(from); n <= dayNumber(to); n++) {
        const d = fromDayNumber(n);
        if (!loadedDays.current.has(d)) missing.push(d);
      }
      if (!missing.length) return;
      const { data, error } = await supabase
        .from("task_occurrences")
        .select("*")
        .gte("date", missing[0])
        .lte("date", missing[missing.length - 1]);
      if (error) {
        setLoadError(error.message);
        return;
      }
      for (const d of missing) loadedDays.current.add(d);
      mergeOcc((data as any[]).map(rowToOcc));
      bump((n) => n + 1);
    },
    [mergeOcc],
  );

  const isDayLoaded = useCallback((date: ISODate) => loadedDays.current.has(date), []);

  const today = todayISO(now);
  useEffect(() => {
    if (userId) void ensureDay(today);
  }, [userId, today, ensureDay]);

  const timeOn = useCallback(
    (task: Task, date: ISODate) => occ.get(keyOf(task.id, date))?.time_override ?? task.time,
    [occ],
  );

  const restockDoneDate = useCallback(
    (taskId: string): ISODate | null => {
      let found: ISODate | null = null;
      for (const o of occ.values()) {
        if (o.task_id === taskId && o.status === "done" && (!found || o.date < found)) found = o.date;
      }
      return found;
    },
    [occ],
  );

  const instancesOn = useCallback(
    (date: ISODate): TaskInstance[] => {
      const out: TaskInstance[] = [];
      for (const task of tasks) {
        if (task.category === "restock") {
          // Rolls forward each day until it is done. Future days only show the day it was planned for.
          if (date < task.start_date) continue;
          const doneOn = restockDoneDate(task.id);
          if (doneOn && date > doneOn) continue;
          if (date !== task.start_date && date > today) continue;
        } else if (!occursOn(task, date)) {
          continue;
        }
        const o = occ.get(keyOf(task.id, date));
        out.push({ task, date, status: o?.status ?? "pending", time: o?.time_override ?? task.time });
      }
      return out.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.task.created_at.localeCompare(b.task.created_at));
    },
    [tasks, occ, restockDoneDate, today],
  );

  const dueReminders = useMemo(() => {
    const t = nowTime(now);
    return instancesOn(today).filter(
      (i) =>
        (i.task.category === "reminder" || i.task.category === "birthday") &&
        i.status === "pending" &&
        i.time !== null &&
        i.time <= t &&
        !silenced.has(keyOf(i.task.id, i.date)),
    );
  }, [instancesOn, today, now, silenced]);

  const silence = useCallback((i: TaskInstance) => {
    setSilenced((s) => new Set(s).add(keyOf(i.task.id, i.date)));
  }, []);
  const isSilenced = useCallback((i: TaskInstance) => silenced.has(keyOf(i.task.id, i.date)), [silenced]);

  /** Runs a change, turning failures into a visible message instead of silent loss. */
  const attempt = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    setActionError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setActionError(describe(e));
      return false;
    }
  }, []);

  const insertTask = async (input: NewTask): Promise<Task> => {
    const { data, error } = await supabase.from("tasks").insert(input).select().single();
    if (error) throw error;
    const task = rowToTask(data);
    setTasks((prev) => [...prev, task]);
    return task;
  };

  const patchTask = async (id: string, patch: Partial<NewTask>): Promise<Task> => {
    const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
    if (error) throw error;
    const task = rowToTask(data);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    return task;
  };

  const upsertOcc = async (taskId: string, date: ISODate, fields: Partial<Occurrence>) => {
    const { data, error } = await supabase
      .from("task_occurrences")
      .upsert({ task_id: taskId, date, ...fields }, { onConflict: "task_id,date" })
      .select()
      .single();
    if (error) throw error;
    mergeOcc([rowToOcc(data)]);
  };

  const removeTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const endSeriesBefore = (task: Task, date: ISODate): Recurrence =>
    ({ ...task.recurrence, until: addDays(date, -1) }) as Recurrence;

  // Google's window can only open straight from a tap, so the token is requested first thing in a
  // mutation, before any network call, and the calendar work happens once it arrives.
  useEffect(() => {
    if (googleConfigured) void loadGoogle().catch(() => undefined);
  }, []);

  const startToken = (): Promise<string | Error> =>
    requestGoogleToken(session?.user.email ?? undefined).catch((e: unknown) =>
      e instanceof Error ? e : new Error(String(e)),
    );

  /** Calendar trouble never loses the task: it is saved first, and the problem is shown clearly. */
  const withGcal = async (tok: Promise<string | Error>, what: string, fn: (token: string) => Promise<void>) => {
    const t = await tok;
    if (t instanceof Error) {
      setActionError(`${what}: ${t.message}`);
      return;
    }
    try {
      await fn(t);
    } catch (e) {
      setActionError(`${what}: ${describe(e)}`);
    }
  };

  const addToCalendar = async (token: string, task: Task) => {
    const id = await createEvent(token, task);
    await patchTask(task.id, { gcal_event_id: id });
  };

  const pendingGcal = tasks.filter(
    (t) => t.add_to_gcal && !t.gcal_event_id && (t.recurrence.type !== "once" || t.start_date >= today),
  );

  const value: Ctx = {
    tasks,
    loading,
    loadError,
    actionError,
    clearActionError: () => setActionError(null),
    reload,
    ensureDay,
    ensureRange,
    isDayLoaded,
    instancesOn,
    timeOn,
    dueReminders,
    silence,
    isSilenced,
    lastImport,
    importFromGoogle: () => {
      const tok = startToken();
      return attempt(() =>
        withGcal(tok, "Could not read Google Calendar", async (token) => {
          const events = (await listEvents(token, today, addDays(today, 14))).filter(isImportable);
          const known = new Set(tasks.filter((t) => t.source === "gcal").map((t) => t.source_ref));
          const fresh = events.filter((e) => !known.has(e.id));
          for (const e of fresh) await insertTask(eventToTask(e));
          // The weekly nudge to run this again, because a browser app cannot sync by itself.
          const hasNudge = tasks.some((t) => t.source_ref === "gcal-sync");
          if (!hasNudge) {
            await insertTask({
              title: "Sync Google Calendar into Homie",
              category: "reminder",
              time: "07:00",
              start_date: addDays(today, (7 - weekday(today)) % 7 || 7),
              recurrence: { type: "weekly", days: [0], until: null },
              add_to_gcal: false,
              source: "manual",
              source_ref: "gcal-sync",
              target: null,
              gcal_event_id: null,
            });
          }
          setLastImport({ count: fresh.length, at: new Date().toISOString(), addedSundayTask: !hasNudge });
        }),
      );
    },
    pendingGcal,
    syncPendingGcal: () => {
      const tok = startToken();
      const list = pendingGcal;
      return attempt(() =>
        withGcal(tok, "Could not add to Google Calendar", async (token) => {
          for (const task of list) await addToCalendar(token, task);
        }),
      );
    },
    createTask: (input) => {
      const tok = input.add_to_gcal ? startToken() : null;
      return attempt(async () => {
        const task = await insertTask(input);
        if (tok) await withGcal(tok, "Saved, but not added to Google Calendar", (token) => addToCalendar(token, task));
      });
    },
    setStatus: (task, date, status) => attempt(() => upsertOcc(task.id, date, { status })),
    moveTime: (task, date, time) => {
      const once = task.recurrence.type === "once";
      const tok = once && task.gcal_event_id ? startToken() : null;
      return attempt(async () => {
        // A one-off task owns its time. A recurring task only moves for this one day.
        if (!once) {
          await upsertOcc(task.id, date, { time_override: time });
          return;
        }
        const moved = await patchTask(task.id, { time });
        if (tok) {
          await withGcal(tok, "Moved here, but Google Calendar was not updated", (token) =>
            updateEvent(token, moved.gcal_event_id as string, moved),
          );
        }
      });
    },
    modifyTask: (task, date, scope, next) => {
      const tok = task.gcal_event_id || next.add_to_gcal ? startToken() : null;
      const sorry = "Saved, but Google Calendar was not updated";
      return attempt(async () => {
        const inPlace =
          task.recurrence.type === "once" || task.recurrence.type === "yearly" || task.category === "restock";
        if (inPlace || (scope === "future" && date === task.start_date)) {
          const updated = await patchTask(task.id, next);
          if (!tok) return;
          await withGcal(tok, sorry, async (token) => {
            if (updated.add_to_gcal && updated.gcal_event_id) await updateEvent(token, updated.gcal_event_id, updated);
            else if (updated.add_to_gcal) await addToCalendar(token, updated);
            else if (updated.gcal_event_id) {
              await deleteEvent(token, updated.gcal_event_id);
              await patchTask(updated.id, { gcal_event_id: null });
            }
          });
          return;
        }
        if (scope === "only") {
          await upsertOcc(task.id, date, { status: "skipped" });
          const created = await insertTask({ ...next, start_date: date, recurrence: { type: "once" }, gcal_event_id: null });
          if (!tok) return;
          await withGcal(tok, sorry, async (token) => {
            if (task.gcal_event_id) await deleteInstance(token, task.gcal_event_id, task, date);
            if (created.add_to_gcal) await addToCalendar(token, created);
          });
          return;
        }
        const ended = await patchTask(task.id, { recurrence: endSeriesBefore(task, date) });
        const created = await insertTask({ ...next, start_date: date, gcal_event_id: null });
        if (!tok) return;
        await withGcal(tok, sorry, async (token) => {
          if (ended.gcal_event_id) await updateEvent(token, ended.gcal_event_id, ended);
          if (created.add_to_gcal) await addToCalendar(token, created);
        });
      });
    },
    deleteTask: (task, date, scope) => {
      const tok = task.gcal_event_id ? startToken() : null;
      const sorry = "Deleted here, but Google Calendar was not updated";
      return attempt(async () => {
        const wholeTask =
          task.recurrence.type === "once" || task.recurrence.type === "yearly" || task.category === "restock";
        if (wholeTask || (scope === "future" && date === task.start_date)) {
          await removeTask(task.id);
          if (tok) await withGcal(tok, sorry, (token) => deleteEvent(token, task.gcal_event_id as string));
        } else if (scope === "only") {
          await upsertOcc(task.id, date, { status: "skipped" });
          if (tok) await withGcal(tok, sorry, (token) => deleteInstance(token, task.gcal_event_id as string, task, date));
        } else {
          const ended = await patchTask(task.id, { recurrence: endSeriesBefore(task, date) });
          if (tok) await withGcal(tok, sorry, (token) => updateEvent(token, task.gcal_event_id as string, ended));
        }
      });
    },
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used inside TasksProvider");
  return ctx;
}

