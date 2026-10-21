import { useMemo, useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import { formatTime } from "../../lib/dates";
import { ALL_SLOTS, slotCounts, slotState } from "./slots";
import { useTasks, type EditScope, type TaskInstance } from "./TasksProvider";

/** Asked before changing or deleting one occurrence of a repeating task. */
export function ScopeSheet({
  open,
  verb,
  onChoose,
  onClose,
  busy,
}: {
  open: boolean;
  verb: "Modify" | "Delete";
  onChoose: (scope: EditScope) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`${verb} repeating task`}
      description="This task repeats. Which days should the change apply to?"
    >
      <div className="flex flex-col gap-3">
        <button type="button" disabled={busy} className="btn-secondary text-left" onClick={() => onChoose("only")}>
          This day only
        </button>
        <button type="button" disabled={busy} className="btn-secondary text-left" onClick={() => onChoose("future")}>
          This and future days
        </button>
        <button type="button" className="min-h-11 text-muted" onClick={onClose}>
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}

export function ConfirmDeleteSheet({
  inst,
  onConfirm,
  onClose,
  busy,
}: {
  inst: TaskInstance | null;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <BottomSheet
      open={Boolean(inst)}
      onOpenChange={(o) => !o && onClose()}
      title="Delete this task?"
      description={inst ? `"${inst.task.title}" will be removed.` : undefined}
    >
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>
          Keep it
        </button>
        <button type="button" disabled={busy} className="btn-danger flex-1" onClick={onConfirm}>
          Delete
        </button>
      </div>
    </BottomSheet>
  );
}

/** Keyboard and screen-reader friendly alternative to dragging a card. */
export function ChangeTimeSheet({
  inst,
  onSave,
  onClose,
  busy,
}: {
  inst: TaskInstance | null;
  onSave: (time: string) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const { tasks, timeOn } = useTasks();
  const [manual, setManual] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  const counts = useMemo(
    () => (inst ? slotCounts(tasks, inst.date, inst.task.id, (t) => timeOn(t, inst.date)) : new Map<string, number>()),
    [tasks, inst, timeOn],
  );
  const current = picked ?? inst?.time ?? "09:00";
  const choices = ALL_SLOTS.filter((s) => s === current || (manual ? slotState(counts, s) !== "full" : slotState(counts, s) === "free"));

  return (
    <BottomSheet
      open={Boolean(inst)}
      onOpenChange={(o) => {
        if (!o) {
          setPicked(null);
          onClose();
        }
      }}
      title="Change time"
      description={inst ? `Only moves "${inst.task.title}" on this day.` : undefined}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="change-time" className="mb-2 block text-sm font-medium">
            New time
          </label>
          <select id="change-time" className="input" value={current} onChange={(e) => setPicked(e.target.value)}>
            {choices.map((s) => (
              <option key={s} value={s}>
                {formatTime(s)}
                {slotState(counts, s) === "shared" ? " (shares a slot)" : ""}
              </option>
            ))}
          </select>
          <label className="mt-3 flex min-h-11 items-center gap-3">
            <input type="checkbox" className="check" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            <span>Include slots that already have a task</span>
          </label>
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-primary flex-1"
            onClick={() => {
              onSave(current);
              setPicked(null);
            }}
          >
            Save time
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
