import type { TaskInstance } from "../tasks/TasksProvider";
import type { Category } from "../tasks/types";

export type DayStats = {
  total: number;
  done: number;
  /** Done divided by everything that was not skipped. Null when nothing is planned. */
  percent: number | null;
  categories: Category[];
};

const ORDER: Category[] = ["restock", "routine", "reminder", "birthday", "goal"];

export function dayStats(instances: TaskInstance[]): DayStats {
  const active = instances.filter((i) => i.status !== "skipped");
  const done = active.filter((i) => i.status === "done").length;
  const present = new Set(active.map((i) => i.task.category));
  return {
    total: active.length,
    done,
    percent: active.length ? Math.round((done / active.length) * 100) : null,
    categories: ORDER.filter((c) => present.has(c)),
  };
}

/** `future` days have nothing to complete yet, so they show a count instead of a percentage. */
export function describeDay(label: string, s: DayStats, future = false): string {
  if (!s.total) return `${label}, nothing planned`;
  const count = `${s.total} ${s.total === 1 ? "task" : "tasks"}`;
  return future ? `${label}, ${count} planned` : `${label}, ${count}, ${s.percent} percent done`;
}
