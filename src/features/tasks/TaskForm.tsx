import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  addDays,
  comingSaturday,
  formatDayShort,
  formatTime,
  nowTime,
  todayISO,
  weekday,
  type ISODate,
} from "../../lib/dates";
import { ALL_SLOTS, nextSlotAfter, slotCounts, slotState, suggestSlot } from "./slots";
import { useTasks } from "./TasksProvider";
import type { Category, NewTask, Recurrence, Task } from "./types";

type FreqKey =
  | "today"
  | "tomorrow"
  | "weekly"
  | "daily"
  | "weekdays"
  | "weekends"
  | "alternate_day"
  | "alternate_weekday"
  | "twice_weekly"
  | "monthly";

const FREQUENCIES: { key: FreqKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekly", label: "Every week on" },
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Weekdays" },
  { key: "weekends", label: "Weekends" },
  { key: "alternate_day", label: "Alternate day" },
  { key: "alternate_weekday", label: "Alternate weekday" },
  { key: "twice_weekly", label: "Twice a week" },
  { key: "monthly", label: "Monthly" },
];

const FORM_CATEGORIES: { key: Category; label: string }[] = [
  { key: "restock", label: "Shopping List" },
  { key: "routine", label: "Daily routine" },
  { key: "reminder", label: "Reminder" },
  { key: "birthday", label: "Birthday" },
  { key: "goal", label: "Goal" },
];

/** Only Daily routine repeats on a schedule. Reminders, goals and shopping are single dated items. */
const ONE_OFF: Category[] = ["reminder", "goal", "restock"];
const DATE_LABEL: Partial<Record<Category, string>> = {
  reminder: "Date",
  goal: "Due date",
  restock: "Buy on",
};

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function freqFromRecurrence(task: Task): FreqKey {
  const r = task.recurrence;
  if (r.type === "weekly") return r.days.length === 2 ? "twice_weekly" : "weekly";
  if (r.type === "once" || r.type === "yearly") return "today";
  return r.type;
}

type Props = {
  /** The day being viewed. New tasks start here by default. */
  date: ISODate;
  /** Present when modifying. */
  editing?: Task;
  onSubmit: (task: NewTask) => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  busy?: boolean;
};

export default function TaskForm({ date, editing, onSubmit, onCancel, submitLabel, busy }: Props) {
  const { tasks, timeOn } = useTasks();
  const uid = useId();
  const today = todayISO();
  const editingRecurring = Boolean(editing && editing.recurrence.type !== "once");

  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<Category>(editing ? editing.category : "routine");
  const [freq, setFreq] = useState<FreqKey>(editing ? freqFromRecurrence(editing) : date > today ? "tomorrow" : "today");
  const [startsOn, setStartsOn] = useState<ISODate>(editing ? (editing.recurrence.type === "once" ? editing.start_date : date) : date);
  const defaultOnceDate = (c: Category): ISODate => (c === "restock" ? comingSaturday(today) : date);
  const [onceDate, setOnceDate] = useState<ISODate>(
    editing && ONE_OFF.includes(editing.category) ? editing.start_date : defaultOnceDate(editing?.category ?? "routine"),
  );
  const [birthDate, setBirthDate] = useState<ISODate>(editing?.category === "birthday" ? editing.start_date : today);
  const [days, setDays] = useState<number[]>(
    editing?.recurrence.type === "weekly" ? editing.recurrence.days : [weekday(date)],
  );
  const initialUntil = editing && "until" in editing.recurrence ? editing.recurrence.until : null;
  const [indefinite, setIndefinite] = useState(initialUntil === null);
  const [until, setUntil] = useState<ISODate>(initialUntil ?? addDays(date, 30));
  const [manual, setManual] = useState(false);
  const [target, setTarget] = useState(editing?.target ?? "");
  const [gcal, setGcal] = useState(editing?.add_to_gcal ?? false);
  const [showErrors, setShowErrors] = useState(false);

  const isBirthday = category === "birthday";
  const oneOff = ONE_OFF.includes(category);
  const repeats = !isBirthday && !oneOff && freq !== "today" && freq !== "tomorrow";
  const scheduleDate: ISODate = isBirthday
    ? birthDate
    : oneOff
      ? onceDate
      : freq === "today"
      ? today
      : freq === "tomorrow"
        ? addDays(today, 1)
        : startsOn;

  const counts = useMemo(
    () => slotCounts(tasks, scheduleDate, editing?.id, (t) => timeOn(t, scheduleDate)),
    [tasks, scheduleDate, editing?.id, timeOn],
  );

  const [time, setTime] = useState<string>(() => {
    if (editing?.time) return editing.time;
    const after = date === today ? nextSlotAfter(nowTime()) : undefined;
    return suggestSlot(slotCounts(tasks, date, undefined, (t) => timeOn(t, date)), after) ?? "09:00";
  });

  const [timeTouched, setTimeTouched] = useState(Boolean(editing));
  useEffect(() => {
    // Until the user picks a time themselves, keep the suggestion on a free slot for the chosen day.
    if (timeTouched) return;
    const after = scheduleDate === today ? nextSlotAfter(nowTime()) : undefined;
    setTime(suggestSlot(counts, after) ?? "09:00");
  }, [scheduleDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const slotChoices = ALL_SLOTS.filter((s) => {
    const st = slotState(counts, s);
    if (s === time) return true;
    return manual ? st !== "full" : st === "free";
  });
  const noFree = ALL_SLOTS.every((s) => slotState(counts, s) !== "free");

  const dayCount = freq === "twice_weekly" ? 2 : 1;
  const toggleDay = (d: number) => {
    setDays((prev) => {
      if (dayCount === 1) return [d];
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return prev.length >= 2 ? [prev[1], d] : [...prev, d];
    });
  };

  const errors = {
    title: title.trim() ? "" : "Give the task a name.",
    days: repeats && (freq === "weekly" || freq === "twice_weekly") && days.length !== dayCount
      ? dayCount === 2 ? "Pick two days." : "Pick a day."
      : "",
    until: repeats && !indefinite && until < scheduleDate ? "The end date must be on or after the start." : "",
    date: !editing && oneOff && scheduleDate < today ? "Pick today or a later date." : "",
    time: slotState(counts, time) === "full" ? "That time already has two tasks. Pick another." : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const buildRecurrence = (): Recurrence => {
    if (isBirthday) return { type: "yearly" };
    if (oneOff || !repeats) return { type: "once" };
    const end = indefinite ? null : until;
    if (freq === "weekly" || freq === "twice_weekly") {
      return { type: "weekly", days: [...days].sort((a, b) => a - b), until: end };
    }
    return { type: freq as "daily", until: end };
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (hasErrors) return;
    void onSubmit({
      title: title.trim(),
      category,
      time,
      start_date: scheduleDate,
      recurrence: buildRecurrence(),
      add_to_gcal: isBirthday ? true : gcal,
      source: editing?.source ?? "manual",
      source_ref: editing?.source_ref ?? null,
      target: category === "goal" && target.trim() ? target.trim() : null,
      gcal_event_id: editing?.gcal_event_id ?? null,
    });
  };

  const lockedStart = editingRecurring; // a recurring edit keeps the chosen day

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Name" error={showErrors ? errors.title : ""} htmlFor={`${uid}-title`}>
        <input
          id={`${uid}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="What needs doing?"
          aria-invalid={showErrors && Boolean(errors.title)}
          className="input"
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Category</legend>
        <div className="flex flex-wrap gap-2">
          {FORM_CATEGORIES.map((c) => (
            <Pill
              key={c.key}
              selected={category === c.key}
              onClick={() => {
                setCategory(c.key);
                if (c.key === "birthday") setGcal(true);
                if (ONE_OFF.includes(c.key)) setOnceDate(defaultOnceDate(c.key));
              }}
            >
              {c.label}
            </Pill>
          ))}
        </div>
      </fieldset>

      {category === "goal" ? (
        <Field label="Target (optional)" htmlFor={`${uid}-target`}>
          <input
            id={`${uid}-target`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="For example: finish 3 chapters"
            autoComplete="off"
            className="input"
          />
        </Field>
      ) : null}

      {oneOff ? (
        <Field
          label={DATE_LABEL[category] ?? "Date"}
          htmlFor={`${uid}-once`}
          error={showErrors ? errors.date : ""}
          hint={category === "restock" ? "Defaults to the coming Saturday. It stays on your list each day until you tick it off." : undefined}
        >
          <input
            id={`${uid}-once`}
            type="date"
            value={onceDate}
            onChange={(e) => e.target.value && setOnceDate(e.target.value)}
            className="input"
          />
        </Field>
      ) : isBirthday ? (
        <Field label="Birthday" htmlFor={`${uid}-bday`} hint="Repeats every year.">
          <input
            id={`${uid}-bday`}
            type="date"
            value={birthDate}
            onChange={(e) => e.target.value && setBirthDate(e.target.value)}
            className="input"
          />
        </Field>
      ) : (
        <>
          <Field label="How often" htmlFor={`${uid}-freq`}>
            <select
              id={`${uid}-freq`}
              value={freq}
              onChange={(e) => {
                const next = e.target.value as FreqKey;
                setFreq(next);
                if (next === "twice_weekly" && days.length < 2) setDays([weekday(scheduleDate), (weekday(scheduleDate) + 3) % 7]);
                if (next === "weekly" && days.length !== 1) setDays([weekday(scheduleDate)]);
              }}
              className="input"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          {freq === "weekly" || freq === "twice_weekly" ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                {freq === "weekly" ? "On which day" : "On which two days"}
              </legend>
              <div className="flex justify-between gap-1">
                {DAY_LETTERS.map((letter, d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={days.includes(d)}
                    aria-label={DAY_NAMES[d]}
                    onClick={() => toggleDay(d)}
                    className={`pressable grid size-11 place-items-center rounded-full text-sm font-medium ${
                      days.includes(d) ? "bg-accent text-on-accent" : "bg-sunken text-ink"
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              {showErrors && errors.days ? <ErrorText>{errors.days}</ErrorText> : null}
            </fieldset>
          ) : null}

          {repeats && !lockedStart ? (
            <Field label="Starts on" htmlFor={`${uid}-start`}>
              <input
                id={`${uid}-start`}
                type="date"
                value={startsOn}
                onChange={(e) => e.target.value && setStartsOn(e.target.value)}
                className="input"
              />
            </Field>
          ) : null}

          {repeats ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Ends</legend>
              <div className="flex gap-2">
                <Pill selected={indefinite} onClick={() => setIndefinite(true)}>
                  Indefinitely
                </Pill>
                <Pill selected={!indefinite} onClick={() => setIndefinite(false)}>
                  Until a date
                </Pill>
              </div>
              {!indefinite ? (
                <div className="mt-3">
                  <label htmlFor={`${uid}-until`} className="sr-only">
                    End date
                  </label>
                  <input
                    id={`${uid}-until`}
                    type="date"
                    value={until}
                    min={scheduleDate}
                    onChange={(e) => e.target.value && setUntil(e.target.value)}
                    className="input"
                  />
                  {showErrors && errors.until ? <ErrorText>{errors.until}</ErrorText> : null}
                </div>
              ) : null}
            </fieldset>
          ) : null}
        </>
      )}

      <Field
        label="Time"
        htmlFor={`${uid}-time`}
        error={showErrors || errors.time ? errors.time : ""}
        hint={
          noFree && !manual
            ? "Every slot that day is taken. Use Pick manually to share one."
            : `Showing free slots for ${formatDayShort(scheduleDate)}.`
        }
      >
        <select id={`${uid}-time`} value={time} onChange={(e) => {
            setTime(e.target.value);
            setTimeTouched(true);
          }}
          className="input">
          {slotChoices.map((s) => (
            <option key={s} value={s}>
              {formatTime(s)}
              {slotState(counts, s) === "shared" ? " (shares a slot)" : ""}
            </option>
          ))}
        </select>
        <label className="mt-3 flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="check" />
          <span>Pick manually (allows two tasks at one time)</span>
        </label>
      </Field>

      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={isBirthday ? true : gcal}
          disabled={isBirthday}
          onChange={(e) => setGcal(e.target.checked)}
          className="check mt-0.5"
        />
        <span>
          Add to Google Calendar
          <span className="block text-sm text-muted">
            {isBirthday ? "Birthdays are always added." : "Sent once Google Calendar is connected."}
          </span>
        </span>
      </label>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {children}
    </p>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`pressable min-h-11 rounded-full px-4 text-sm font-medium ${
        selected ? "bg-accent text-on-accent" : "bg-sunken text-ink"
      }`}
    >
      {children}
    </button>
  );
}
