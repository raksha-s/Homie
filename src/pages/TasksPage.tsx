import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import SubTabs from "../components/SubTabs";
import Fab from "../components/Fab";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import TaskCard from "../features/tasks/TaskCard";
import TaskForm from "../features/tasks/TaskForm";
import { ChangeTimeSheet, ConfirmDeleteSheet, ScopeSheet } from "../features/tasks/Sheets";
import { slotCounts, slotState } from "../features/tasks/slots";
import { useTasks, type EditScope, type TaskInstance } from "../features/tasks/TasksProvider";
import type { NewTask } from "../features/tasks/types";
import { addDays, formatDay, todayISO } from "../lib/dates";
import { googleConfigured } from "../lib/google";

export const mainTabs = [
  { to: "/main/tasks", label: "My Tasks" },
  { to: "/main/calendar", label: "Calendar" },
];

type Pending =
  | { kind: "modify"; inst: TaskInstance; next: NewTask }
  | { kind: "delete"; inst: TaskInstance }
  | null;

const isRepeating = (i: TaskInstance) =>
  i.task.recurrence.type !== "once" && i.task.recurrence.type !== "yearly" && i.task.category !== "restock";

export default function TasksPage() {
  const t = useTasks();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : today;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TaskInstance | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [deleting, setDeleting] = useState<TaskInstance | null>(null);
  const [changingTime, setChangingTime] = useState<TaskInstance | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void t.ensureDay(date);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const goTo = (d: string) => {
    setExpanded(null);
    setParams(d === today ? {} : { date: d }, { replace: true });
  };

  const instances = t.instancesOn(date);
  const ready = !t.loading && t.isDayLoaded(date);
  const doneCount = instances.filter((i) => i.status === "done").length;
  const activeCount = instances.filter((i) => i.status !== "skipped").length;

  const counts = useMemo(
    () => slotCounts(t.tasks, date, undefined, (task) => t.timeOn(task, date)),
    [t.tasks, date, t.timeOn], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const keyOf = (i: TaskInstance) => `${i.task.id}|${i.date}`;

  const run = async (fn: () => Promise<boolean>, message?: string) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok && message) setNotice(message);
    return ok;
  };

  const handleCreate = async (input: NewTask) => {
    const ok = await run(() => t.createTask(input));
    if (!ok) return;
    setAdding(false);
    // Stay where you are. If the task landed on another day, say which one.
    setNotice(
      input.recurrence.type === "once" && input.start_date !== date
        ? `Added "${input.title}" for ${formatDay(input.start_date)}`
        : `Added "${input.title}"`,
    );
  };

  const handleModifySubmit = async (inst: TaskInstance, next: NewTask) => {
    if (isRepeating(inst)) {
      setPending({ kind: "modify", inst, next });
      return;
    }
    const ok = await run(() => t.modifyTask(inst.task, inst.date, "future", next), "Task updated");
    if (ok) setEditing(null);
  };

  const handleScope = async (scope: EditScope) => {
    if (!pending) return;
    const p = pending;
    const ok = await run(
      () =>
        p.kind === "modify"
          ? t.modifyTask(p.inst.task, p.inst.date, scope, p.next)
          : t.deleteTask(p.inst.task, p.inst.date, scope),
      p.kind === "modify" ? "Task updated" : "Task deleted",
    );
    if (ok) {
      setPending(null);
      setEditing(null);
      setExpanded(null);
    }
  };

  const handleDelete = (inst: TaskInstance) => {
    if (isRepeating(inst)) setPending({ kind: "delete", inst });
    else setDeleting(inst);
  };

  return (
    <>
      <PageHeader title="Homie" />
      <SubTabs tabs={mainTabs} label="Main sections" />

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => goTo(addDays(date, -1))}
          className="pressable grid size-11 place-items-center rounded-full bg-sunken"
        >
          <CaretLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-lg font-semibold">{date === today ? "Today" : formatDay(date)}</h2>
          <p className="text-sm text-muted">
            {date === today ? `${formatDay(date)} · ` : ""}
            {ready ? `${doneCount} of ${activeCount} done` : "Loading"}
          </p>
        </div>
        {date !== today ? (
          <button type="button" onClick={() => goTo(today)} className="btn-secondary !min-h-11 !px-4 text-sm">
            Today
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Next day"
          onClick={() => goTo(addDays(date, 1))}
          className="pressable grid size-11 place-items-center rounded-full bg-sunken"
        >
          <CaretRight size={20} aria-hidden="true" />
        </button>
      </div>

      {t.actionError ? (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-danger p-3 text-sm text-danger">
          <span>Could not save that: {t.actionError}</span>
          <button type="button" onClick={t.clearActionError} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {t.pendingGcal.length > 0 && googleConfigured ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface p-3 text-sm">
          <span>
            {t.pendingGcal.length} {t.pendingGcal.length === 1 ? "task is" : "tasks are"} waiting to be added to Google
            Calendar.
          </span>
          <button
            type="button"
            className="btn-primary !min-h-10 shrink-0 !px-3 text-sm"
            onClick={() => void run(() => t.syncPendingGcal(), "Google Calendar updated")}
          >
            Add now
          </button>
        </div>
      ) : null}

      {t.loadError ? (
        <EmptyState title="Could not load your tasks">
          {t.loadError}
          <span className="mt-4 block">
            <button type="button" className="btn-primary" onClick={() => void t.reload()}>
              Try again
            </button>
          </span>
        </EmptyState>
      ) : !ready ? (
        <ul aria-busy="true" aria-label="Loading tasks" className="flex flex-col gap-3">
          {[0, 1, 2].map((n) => (
            <li key={n} className="h-[84px] animate-pulse rounded-[var(--radius-card)] bg-sunken motion-reduce:animate-none" />
          ))}
        </ul>
      ) : instances.length === 0 ? (
        <EmptyState title={date === today ? "Nothing planned yet" : "Nothing planned for this day"}>
          Tap the plus button to add a task. Tasks you add show up here for the day.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {instances.map((inst) => {
            const k = keyOf(inst);
            const due = t.dueReminders.some((d) => keyOf(d) === k);
            return (
              <TaskCard
                key={k}
                inst={inst}
                due={due}
                expanded={expanded === k}
                onToggleExpand={() => setExpanded(expanded === k ? null : k)}
                onToggleDone={() => void t.setStatus(inst.task, inst.date, inst.status === "done" ? "pending" : "done")}
                onSkip={() => {
                  void t.setStatus(inst.task, inst.date, inst.status === "skipped" ? "pending" : "skipped");
                  setExpanded(null);
                }}
                onModify={() => setEditing(inst)}
                onDelete={() => handleDelete(inst)}
                onChangeTime={() => setChangingTime(inst)}
                onSilence={() => t.silence(inst)}
                onDragMove={(time) => void run(() => t.moveTime(inst.task, inst.date, time), `Moved to ${time}`)}
                slotStateFor={(time) => {
                  const own = inst.time === time ? 1 : 0;
                  const c = new Map(counts);
                  c.set(time, Math.max(0, (c.get(time) ?? 0) - own));
                  return slotState(c, time);
                }}
              />
            );
          })}
        </ul>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4" style={{ bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 84px)" }}>
        {notice ? <p className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">{notice}</p> : null}
      </div>

      <Fab label="Add task" onClick={() => setAdding(true)} />

      <BottomSheet open={adding} onOpenChange={setAdding} title="Add task">
        <TaskForm date={date} onSubmit={handleCreate} onCancel={() => setAdding(false)} submitLabel="Add task" busy={busy} />
      </BottomSheet>

      <BottomSheet
        open={Boolean(editing) && !pending}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Modify task"
      >
        {editing ? (
          <TaskForm
            date={editing.date}
            editing={editing.task}
            onSubmit={(next) => handleModifySubmit(editing, next)}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
            busy={busy}
          />
        ) : null}
      </BottomSheet>

      <ScopeSheet
        open={Boolean(pending)}
        verb={pending?.kind === "delete" ? "Delete" : "Modify"}
        busy={busy}
        onChoose={(s) => void handleScope(s)}
        onClose={() => setPending(null)}
      />

      <ConfirmDeleteSheet
        inst={deleting}
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await run(() => t.deleteTask(deleting.task, deleting.date, "future"), "Task deleted");
          if (ok) {
            setDeleting(null);
            setExpanded(null);
          }
        }}
      />

      <ChangeTimeSheet
        inst={changingTime}
        busy={busy}
        onClose={() => setChangingTime(null)}
        onSave={async (time) => {
          if (!changingTime) return;
          const ok = await run(() => t.moveTime(changingTime.task, changingTime.date, time), "Time changed");
          if (ok) setChangingTime(null);
        }}
      />
    </>
  );
}
