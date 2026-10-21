import { useMemo } from "react";
import { useTasks } from "../tasks/TasksProvider";
import type { ISODate } from "../../lib/dates";
import { dayStats, type DayStats } from "./dayStats";

/** Cached per-day stats that refresh whenever tasks or done marks change. */
export function useDayStats(): (d: ISODate) => DayStats {
  const { instancesOn } = useTasks();
  return useMemo(() => {
    const cache = new Map<ISODate, DayStats>();
    return (d: ISODate) => {
      let s = cache.get(d);
      if (!s) {
        s = dayStats(instancesOn(d));
        cache.set(d, s);
      }
      return s;
    };
  }, [instancesOn]);
}
