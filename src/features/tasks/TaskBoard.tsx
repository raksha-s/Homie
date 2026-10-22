import { useMemo, useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import EmptyState from "../../components/EmptyState";
import Fab from "../../components/Fab";
import { formatDay, todayISO, type ISODate } from "../../lib/dates";
import { googleConfigured } from "../../lib/google";
import { useInventory } from "../inventory/InventoryProvider";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";
import { ChangeTimeSheet, ConfirmDeleteSheet, ScopeSheet } from "./Sheets";
import { slotCounts, slotState } from "./slots";
import { useTasks, type EditScope, type TaskInstance } from "./TasksProvider";
import type { NewTask } from "./types";

type Pending =
  | { kind: "modify"; inst: TaskInstance; next: NewTask }
  | { kind: "delete"; inst: TaskInstance }
  | null;

const isRepeating = (i: TaskInstance) =>
  i.task.recurrence.type !== "once" && i.task.recurrence.type !== "yearly" && i.task.category !== "restock";

const keyOf = (i: TaskInstance) => `${i.task.id}|${i.date}`;

/** What the cards in a day group need from the board: one object so groups stay small. */
type Board = {
  expanded: string | null;
  setExpanded: (k: string | null) => void;
  isDue: (i: TaskInstance) => boolean;
  edit: (i: TaskInstance) => void;
  remove: (i: TaskInstance) => void;
  changeTime: (i: TaskInstance) => void;
  drag: (i: TaskInstance, time: string) => void;
};

/**
 * "Task list": the tasks of one day, or of many days with a line between days. Every card works the
 * same everywhere (tick, skip, modify, delete, move time, drag), and the add button and every sheet live here.
 */
export default function TaskBoard({
  days,
  addDate,
  selected,
  emptyTitle,
  notify,
}: {
  days: ISODate[];
  /** The day a new task starts on. */
  addDate: ISODate;
  /** Day whose label stands out in a multi-day list. */
  selected?: ISODate;
  emptyTitle: string;
  notify: (message: string) => void;
}) {
  const t = useTasks();
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TaskInstance | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [deleting, setDeleting] = useState<TaskInstance | null>(null);
  const [changingTime, setChangingTime] = useState<TaskInstance | null>(null);
  const [busy, setBusy] = useState(false);

  const many = days.length > 1;
  const ready = !t.loading && days.every((d) => t.isDayLoaded(d));
  const groups = useMemo(
    () => days.map((date) => ({ date, instances: t.instancesOn(date) })).filter((g) => g.instances.length),
    [days, t.instancesOn], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const run = async (fn: () => Promise<boolean>, message?: string) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok && message) notify(message);
    return ok;
  };

  const handleCreate = async (input: NewTask) => {
    const ok = await run(() => t.createTask(input));
    if (!ok) return;
    setAdding(false);
    // Stay where you are. If the task landed on another day, say which one.
    notify(
      input.recurrence.type === "once" && input.start_date !== addDate
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

  const board: Board = {
    expanded,
    setExpanded,
    isDue: (i) => t.dueReminders.some((d) => keyOf(d) === keyOf(i)),
    edit: setEditing,
    remove: (inst) => (isRepeating(inst) ? setPending({ kind: "delete", inst }) : setDeleting(inst)),
    changeTime: setChangingTime,
    drag: (inst, time) => void run(() => t.moveTime(inst.task, inst.date, time), `Moved to ${time}`),
  };

  return (
    <section aria-labelledby="task-list" className="mt-5">
      <h2 id="task-list" className="mb-3 scroll-mt-4 text-lg font-semibold tracking-tight">
        Task list
      </h2>

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
            {t.pendingGcal.length} {t.pendingGcal.length === 1 ? "task is" : "tasks are"} waiting to be added to Google Calendar.
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
      ) : groups.length === 0 ? (
        <EmptyState title={emptyTitle}>Tap the plus button to add a task.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-5">
          {groups.map((g) => (
            <DayGroup
              key={g.date}
              date={g.date}
              instances={g.instances}
              label={many}
              isToday={g.date === today}
              isSelected={g.date === selected}
              board={board}
            />
          ))}
        </ul>
      )}

      <Fab label="Add task" onClick={() => setAdding(true)} />

      <BottomSheet open={adding} onOpenChange={setAdding} title="Add task">
        <TaskForm date={addDate} onSubmit={handleCreate} onCancel={() => setAdding(false)} submitLabel="Add task" busy={busy} />
      </BottomSheet>

      <BottomSheet open={Boolean(editing) && !pending} onOpenChange={(o) => !o && setEditing(null)} title="Modify task">
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
    </section>
  );
}

function DayGroup({
  date,
  instances,
  label,
  isToday,
  isSelected,
  board,
}: {
  date: ISODate;
  instances: TaskInstance[];
  label: boolean;
  isToday: boolean;
  isSelected: boolean;
  board: Board;
}) {
  const t = useTasks();
  const inventory = useInventory();
  const counts = useMemo(
    () => slotCounts(t.tasks, date, undefined, (task) => t.timeOn(task, date)),
    [t.tasks, date, t.timeOn], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <li id={`day-${date}`} className="scroll-mt-4">
      {label ? (
        <div className="mb-3 flex items-center gap-3">
          <h3 className={`shrink-0 text-xs ${isSelected || isToday ? "font-semibold text-ink" : "font-medium text-muted"}`}>
            {isToday ? `Today · ${formatDay(date)}` : formatDay(date)}
          </h3>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {instances.map((inst) => {
          const k = keyOf(inst);
          return (
            <TaskCard
              key={k}
              inst={inst}
              due={board.isDue(inst)}
              expanded={board.expanded === k}
              onToggleExpand={() => board.setExpanded(board.expanded === k ? null : k)}
              onToggleDone={() => inventory.toggleDone(inst)}
              onSkip={() => {
                void t.setStatus(inst.task, inst.date, inst.status === "skipped" ? "pending" : "skipped");
                board.setExpanded(null);
              }}
              onModify={() => board.edit(inst)}
              onDelete={() => board.remove(inst)}
              onChangeTime={() => board.changeTime(inst)}
              onSilence={() => t.silence(inst)}
              onDragMove={(time) => board.drag(inst, time)}
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
    </li>
  );
}

