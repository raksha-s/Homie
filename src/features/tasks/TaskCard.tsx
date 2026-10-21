import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowCounterClockwise,
  BellRinging,
  Cake,
  Check,
  Clock,
  Flag,
  PencilSimple,
  ShoppingCart,
  SkipForward,
  Trash,
  type Icon,
} from "@phosphor-icons/react";
import { addDays, formatTime, minutesToTime, startOfWeek, timeToMinutes } from "../../lib/dates";
import { occursOn } from "./recurrence";
import { SLOT_END, SLOT_START, SLOT_STEP, type SlotState } from "./slots";
import type { TaskInstance } from "./TasksProvider";
import { CATEGORY_LABEL, type Category } from "./types";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CATEGORY_ICON: Partial<Record<Category, Icon>> = {
  reminder: BellRinging,
  birthday: Cake,
  goal: Flag,
  restock: ShoppingCart,
};

const LONG_PRESS_MS = 450;
const PX_PER_STEP = 36;

type Props = {
  inst: TaskInstance;
  expanded: boolean;
  due: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onSkip: () => void;
  onModify: () => void;
  onDelete: () => void;
  onChangeTime: () => void;
  onSilence: () => void;
  onDragMove: (time: string) => void;
  /** How full a time slot is, ignoring this task. Used to refuse a drop on a full slot. */
  slotStateFor: (time: string) => SlotState;
};

export default function TaskCard(p: Props) {
  const { inst } = p;
  const { task, status, date, time } = inst;
  const Icon = CATEGORY_ICON[task.category];
  const recurring = task.recurrence.type !== "once" && task.recurrence.type !== "yearly";
  const done = status === "done";
  const skipped = status === "skipped";

  // Which weekdays this task lands on in the viewed week, for the S M T W T F S strip.
  const weekStart = startOfWeek(date);
  const strip = DAY_LETTERS.map((_, i) => occursOn(task, addDays(weekStart, i)));
  const stripLabel = strip
    .map((on, i) => (on ? DAY_NAMES[i].slice(0, 3) : null))
    .filter(Boolean)
    .join(", ");

  /* ---- long-press drag to change time within the day ---- */
  const btnRef = useRef<HTMLButtonElement>(null);
  const press = useRef<{ x: number; y: number; timer: number; active: boolean; base: number } | null>(null);
  const justDragged = useRef(false);
  const [drag, setDrag] = useState<{ dy: number; target: string } | null>(null);

  useEffect(() => {
    // Once a drag has started, stop the page from scrolling under the finger.
    const el = btnRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (press.current?.active && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setDrag(null);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!time || (e.pointerType === "mouse" && e.button !== 0)) return;
    const base = timeToMinutes(time);
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const timer = window.setTimeout(() => {
      if (!press.current) return;
      press.current.active = true;
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* pointer already released */
      }
      navigator.vibrate?.(12);
      setDrag({ dy: 0, target: time });
    }, LONG_PRESS_MS);
    press.current = { x: e.clientX, y: e.clientY, timer, active: false, base };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = press.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (!s.active) {
      // Moving before the long press completes means the user is scrolling.
      if (Math.abs(dy) > 8 || Math.abs(e.clientX - s.x) > 8) cancelPress();
      return;
    }
    const steps = Math.round(dy / PX_PER_STEP);
    const minutes = Math.min(SLOT_END, Math.max(SLOT_START, s.base + steps * SLOT_STEP));
    setDrag({ dy, target: minutesToTime(minutes) });
  };

  const endPress = (commit: boolean) => {
    const s = press.current;
    const current = drag;
    const wasActive = Boolean(s?.active);
    cancelPress();
    if (!wasActive) return;
    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 300);
    if (commit && current && current.target !== time && p.slotStateFor(current.target) !== "full") {
      p.onDragMove(current.target);
    }
  };

  const blocked = drag ? drag.target !== time && p.slotStateFor(drag.target) === "full" : false;

  const dueClass = p.due ? "reminder-due" : "";
  const surface =
    task.category === "reminder" || task.category === "birthday" ? "border-l-4 border-l-[var(--cat-reminder-fg)]" : "";

  return (
    <li
      className={`relative rounded-[var(--radius-card)] border border-line bg-surface ${surface} ${dueClass} ${
        drag ? "z-10 shadow-[var(--shadow)]" : ""
      }`}
      style={drag ? { transform: `translateY(${drag.dy}px)`, transition: "none" } : undefined}
    >
      <div className="flex items-stretch">
        <button
          ref={btnRef}
          type="button"
          aria-expanded={p.expanded}
          onClick={() => {
            if (justDragged.current) return;
            p.onToggleExpand();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endPress(true)}
          onPointerCancel={() => endPress(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-l-[var(--radius-card)] p-4 text-left"
          style={{ touchAction: "pan-y" }}
        >
          <span className="flex items-center gap-2 text-sm text-muted">
            {time ? <span className="font-medium tabular-nums text-ink">{formatTime(time)}</span> : null}
            {task.category !== "routine" ? (
              <span className={`badge badge-${task.category}`}>
                {Icon ? <Icon size={14} weight="fill" aria-hidden="true" /> : null}
                {CATEGORY_LABEL[task.category]}
              </span>
            ) : null}
            {skipped ? <span className="badge badge-skipped">Skipped</span> : null}
          </span>
          <span
            className={`break-words text-base font-medium ${done || skipped ? "text-muted line-through" : "text-ink"}`}
          >
            {task.title}
          </span>
          {task.target ? <span className="text-sm text-muted">Target: {task.target}</span> : null}
          {recurring ? (
            <span className="mt-1 flex gap-1" role="img" aria-label={`Repeats on ${stripLabel || "other weeks"}`}>
              {DAY_LETTERS.map((l, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full text-[11px] font-medium ${
                    strip[i] ? "bg-accent text-on-accent" : "bg-sunken text-muted"
                  }`}
                >
                  {l}
                </span>
              ))}
            </span>
          ) : null}
        </button>

        <div className="flex items-center pr-3">
          {skipped ? null : (
            <button
              type="button"
              onClick={p.onToggleDone}
              aria-pressed={done}
              aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
              className={`pressable grid size-11 place-items-center rounded-full border-2 ${
                done ? "border-accent bg-accent text-on-accent" : "border-line text-transparent"
              }`}
            >
              <Check size={22} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {drag ? (
        <div
          role="status"
          className={`absolute -top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold shadow ${
            blocked ? "bg-danger text-bg" : "bg-ink text-bg"
          }`}
        >
          {blocked ? "That time is full" : `Move to ${formatTime(drag.target)}`}
        </div>
      ) : null}

      {p.due && !p.expanded ? (
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-sm">
          <span className="font-medium">Due now</span>
          <button type="button" onClick={p.onSilence} className="btn-secondary !min-h-9 !px-3 text-sm">
            Silence
          </button>
        </div>
      ) : null}

      {p.expanded ? (
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-4">
          {skipped ? (
            <ActionButton icon={ArrowCounterClockwise} label="Undo skip" onClick={p.onSkip} />
          ) : (
            <ActionButton icon={SkipForward} label="Skip" onClick={p.onSkip} />
          )}
          <ActionButton icon={PencilSimple} label="Modify" onClick={p.onModify} />
          {time ? <ActionButton icon={Clock} label="Change time" onClick={p.onChangeTime} /> : null}
          <ActionButton icon={Trash} label="Delete" onClick={p.onDelete} danger />
        </div>
      ) : null}
    </li>
  );
}

function ActionButton({
  icon: IconCmp,
  label,
  onClick,
  danger,
}: {
  icon: Icon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-sunken px-3 text-sm font-medium ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      <IconCmp size={18} aria-hidden="true" />
      {label}
    </button>
  );
}
