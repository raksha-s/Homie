import {
  addDays,
  dayNumber,
  fromDayNumber,
  minutesToTime,
  nowTime,
  parseISO,
  timeToMinutes,
  todayISO,
  toISO,
  type ISODate,
} from "../../lib/dates";
import { googleFetch } from "../../lib/google";
import { occursOn } from "./recurrence";
import type { NewTask, Recurrence, Task } from "./types";

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DEFAULT_MINUTES = 30;
/** Alternate-weekday has no calendar rule, so it is written as a list of dates this far ahead. */
const RDATE_HORIZON_DAYS = 180;

const compactDate = (d: ISODate) => d.replaceAll("-", "");
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "20261021T033000Z" for a local date and time. */
function utcStamp(date: ISODate, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function endOfDayUtc(date: ISODate): string {
  return new Date(`${date}T23:59:59`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** First day the task really happens on or after today (or its start), which is where the event begins. */
export function firstOccurrence(task: Pick<Task, "start_date" | "recurrence">, from: ISODate = todayISO()): ISODate {
  // A birthday's start is the year they were born, so its calendar event begins at the next one.
  const begin = task.recurrence.type === "yearly" && task.start_date < from ? from : task.start_date;
  for (let i = 0; i < 400; i++) {
    const d = addDays(begin, i);
    if (occursOn(task, d)) return d;
  }
  return task.start_date;
}

export function recurrenceLines(task: Task, first: ISODate, allDay: boolean): string[] | undefined {
  const r: Recurrence = task.recurrence;
  if (r.type === "once") return undefined;
  const until = "until" in r ? r.until : null;
  const untilPart = until ? `;UNTIL=${allDay ? compactDate(until) : endOfDayUtc(until)}` : "";
  const tz = timeZone();

  switch (r.type) {
    case "yearly":
      return ["RRULE:FREQ=YEARLY"];
    case "daily":
      return [`RRULE:FREQ=DAILY${untilPart}`];
    case "alternate_day":
      return [`RRULE:FREQ=DAILY;INTERVAL=2${untilPart}`];
    case "weekdays":
      return [`RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR${untilPart}`];
    case "weekends":
      return [`RRULE:FREQ=WEEKLY;BYDAY=SA,SU${untilPart}`];
    case "weekly":
      return [`RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((d) => BYDAY[d]).join(",")}${untilPart}`];
    case "monthly":
      return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${parseISO(task.start_date).d}${untilPart}`];
    case "alternate_weekday": {
      const dates: string[] = [];
      const last = until && until < addDays(first, RDATE_HORIZON_DAYS) ? until : addDays(first, RDATE_HORIZON_DAYS);
      for (let n = dayNumber(first) + 1; n <= dayNumber(last); n++) {
        const d = fromDayNumber(n);
        if (occursOn(task, d)) dates.push(`${compactDate(d)}T${(task.time ?? "09:00").replace(":", "")}00`);
      }
      return dates.length ? [`RDATE;TZID=${tz}:${dates.join(",")}`] : undefined;
    }
  }
}

/** The Google Calendar event body for a task. Pure, so it can be tested without calling Google. */
export function buildEvent(task: Task, today: ISODate = todayISO()): Record<string, unknown> {
  const allDay = task.category === "birthday" || !task.time;
  const first = firstOccurrence(task, today);
  const tz = timeZone();
  const body: Record<string, unknown> = {
    summary: task.title,
    description: task.target ? `Target: ${task.target}\n\nAdded by Homie` : "Added by Homie",
    extendedProperties: { private: { homieTaskId: task.id } },
  };

  if (allDay) {
    body.start = { date: first };
    body.end = { date: addDays(first, 1) };
  } else {
    const time = task.time as string;
    const endMinutes = timeToMinutes(time) + DEFAULT_MINUTES;
    body.start = { dateTime: `${first}T${time}:00`, timeZone: tz };
    body.end = { dateTime: `${first}T${minutesToTime(Math.min(endMinutes, 23 * 60 + 59))}:00`, timeZone: tz };
    body.reminders =
      task.category === "reminder"
        ? { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] }
        : { useDefault: true };
  }

  const recurrence = recurrenceLines(task, first, allDay);
  if (recurrence) body.recurrence = recurrence;
  return body;
}

async function check(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  let detail = "";
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
  } catch {
    /* no body */
  }
  throw new Error(`${what} failed (${res.status})${detail ? `: ${detail}` : ""}`);
}

export async function createEvent(token: string, task: Task): Promise<string> {
  const res = await check(
    await googleFetch(token, EVENTS, { method: "POST", body: JSON.stringify(buildEvent(task)) }),
    "Adding to Google Calendar",
  );
  return ((await res.json()) as { id: string }).id;
}

export async function updateEvent(token: string, eventId: string, task: Task): Promise<void> {
  const res = await googleFetch(token, `${EVENTS}/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body: JSON.stringify(buildEvent(task)),
  });
  if (res.status === 404 || res.status === 410) return;
  await check(res, "Updating Google Calendar");
}

export async function deleteEvent(token: string, eventId: string): Promise<void> {
  const res = await googleFetch(token, `${EVENTS}/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  if (res.status === 404 || res.status === 410) return;
  await check(res, "Removing from Google Calendar");
}

/** Remove a single day from a repeating event. */
export async function deleteInstance(token: string, eventId: string, task: Task, date: ISODate): Promise<void> {
  const allDay = task.category === "birthday" || !task.time;
  const suffix = allDay ? compactDate(date) : utcStamp(date, task.time as string);
  const res = await googleFetch(token, `${EVENTS}/${encodeURIComponent(`${eventId}_${suffix}`)}`, { method: "DELETE" });
  if (res.status === 404 || res.status === 410) return;
  await check(res, "Removing that day from Google Calendar");
}


export type GoogleEvent = {
  id: string;
  /** For one day of a repeating event, the id of the whole series. */
  recurringEventId?: string;
  /** Google marks events made with its "Birthday" option as "birthday". */
  eventType?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/** Events in [from, to] with repeats already expanded into single days, soonest first. */
export async function listEvents(token: string, from: ISODate, to: ISODate): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(`${from}T00:00:00`).toISOString(),
    timeMax: new Date(`${addDays(to, 1)}T00:00:00`).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await check(await googleFetch(token, `${EVENTS}?${params}`), "Reading Google Calendar");
  return ((await res.json()) as { items?: GoogleEvent[] }).items ?? [];
}

/** Events Homie made itself, and cancelled ones, are not imported back. */
export function isImportable(e: GoogleEvent): boolean {
  return e.status !== "cancelled" && !e.extendedProperties?.private?.homieTaskId && Boolean(e.start);
}

/** Google's own birthday type, or an all-day event whose title says birthday. */
export function isBirthdayEvent(e: GoogleEvent): boolean {
  return e.eventType === "birthday" || (Boolean(e.start?.date) && /birthday|b'?day/i.test(e.summary ?? ""));
}

/** One stable key per event. A birthday repeats every year, so it is keyed by the whole series. */
export function importRef(e: GoogleEvent): string {
  return isBirthdayEvent(e) ? (e.recurringEventId ?? e.id) : e.id;
}

/** Birthdays behave like the ones made in Homie: yearly, and due at 9:00 AM on the day. */
export const BIRTHDAY_TIME = "09:00";

/**
 * A Google event becomes a Reminder, or a Birthday when Google says it is one. It is not pushed
 * back to Google, since it already lives there.
 */
export function eventToTask(e: GoogleEvent): NewTask {
  const when = e.start?.dateTime ? new Date(e.start.dateTime) : null;
  const base = {
    title: e.summary?.trim() || "(no title)",
    start_date: when ? toISO(when) : (e.start?.date as string),
    add_to_gcal: false,
    source: "gcal" as const,
    source_ref: importRef(e),
    target: null,
    gcal_event_id: null,
  };
  if (isBirthdayEvent(e)) {
    return { ...base, category: "birthday", time: BIRTHDAY_TIME, recurrence: { type: "yearly" } };
  }
  return { ...base, category: "reminder", time: when ? nowTime(when) : null, recurrence: { type: "once" } };
}
