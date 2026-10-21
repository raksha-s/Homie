import { Check } from "@phosphor-icons/react";
import { formatTime } from "../../lib/dates";
import type { TaskInstance } from "../tasks/TasksProvider";
import { CATEGORY_LABEL } from "../tasks/types";

/**
 * A day's tasks with a tick on each, for the calendar. Done tasks sit back a little.
 * `framed` gives each task its own bordered container (used where the list sits on the page);
 * unframed rows are separated by hairlines (used inside a day card, so frames never nest).
 */
export default function DayTasks({
  instances,
  onToggle,
  framed = false,
}: {
  instances: TaskInstance[];
  onToggle: (i: TaskInstance) => void;
  framed?: boolean;
}) {
  return (
    <ul className={framed ? "flex flex-col gap-2" : "flex flex-col divide-y divide-line"}>
      {instances.map((i) => {
        const done = i.status === "done";
        const skipped = i.status === "skipped";
        return (
          <li
            key={i.task.id}
            className={`flex items-center gap-1 ${
              framed ? "rounded-xl border border-line bg-surface py-1 pl-1 pr-3" : ""
            }`}
          >
            {skipped ? (
              <span className="size-11 shrink-0" aria-hidden="true" />
            ) : (
              <button
                type="button"
                aria-pressed={done}
                aria-label={done ? `Mark ${i.task.title} not done` : `Mark ${i.task.title} done`}
                onClick={() => onToggle(i)}
                className="pressable grid size-11 shrink-0 place-items-center"
              >
                <span
                  className={`grid size-[26px] place-items-center rounded-full border-2 ${
                    done ? "border-accent bg-accent text-on-accent" : "border-line text-transparent"
                  }`}
                >
                  <Check size={16} weight="bold" aria-hidden="true" />
                </span>
              </button>
            )}
            <span className={`min-w-0 flex-1 py-1.5 ${done || skipped ? "opacity-60" : ""}`}>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                {i.time ? <span className="tabular-nums">{formatTime(i.time)}</span> : null}
                {i.task.category !== "routine" ? (
                  <span className={`badge badge-${i.task.category}`}>{CATEGORY_LABEL[i.task.category]}</span>
                ) : null}
                {skipped ? <span className="badge badge-skipped">Skipped</span> : null}
              </span>
              <span className={`block break-words ${done || skipped ? "line-through" : ""}`}>{i.task.title}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
