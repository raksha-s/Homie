import type { ISODate } from "../../lib/dates";

export type Category = "routine" | "reminder" | "restock" | "birthday" | "goal";
export type Source = "manual" | "inventory" | "meal_plan" | "gcal";
export type OccurrenceStatus = "pending" | "done" | "skipped";

export type Recurrence =
  | { type: "once" }
  | { type: "yearly" }
  | {
      type: "daily" | "weekdays" | "weekends" | "alternate_day" | "alternate_weekday" | "monthly";
      until: ISODate | null;
    }
  /** "Every week on [day]" has one day, "Twice a week" has two. 0 = Sunday. */
  | { type: "weekly"; days: number[]; until: ISODate | null };

export type Task = {
  id: string;
  title: string;
  category: Category;
  /** "HH:MM" */
  time: string | null;
  start_date: ISODate;
  recurrence: Recurrence;
  add_to_gcal: boolean;
  gcal_event_id: string | null;
  source: Source;
  source_ref: string | null;
  target: string | null;
  created_at: string;
};

export type NewTask = Omit<Task, "id" | "created_at" | "gcal_event_id"> & { gcal_event_id?: string | null };

export type Occurrence = {
  id: string;
  task_id: string;
  date: ISODate;
  status: OccurrenceStatus;
  time_override: string | null;
};

export const CATEGORY_LABEL: Record<Category, string> = {
  routine: "Daily routine",
  reminder: "Reminder",
  restock: "Restock",
  birthday: "Birthday",
  goal: "Goal",
};

export function isRecurring(r: Recurrence): boolean {
  return r.type !== "once";
}
