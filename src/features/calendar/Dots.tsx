import type { Category } from "../tasks/types";

const LABEL: Record<Category, string> = {
  routine: "Routine",
  reminder: "Reminder",
  restock: "Shopping List",
  birthday: "Birthday",
  goal: "Goal",
};

/** Coloured dots, one per kind of task on the day. The counts and percentage are always shown as text too. */
export default function Dots({ categories, size = 8 }: { categories: Category[]; size?: number }) {
  return (
    <span className="flex items-center justify-center gap-[3px]" style={{ height: size }} aria-hidden="true">
      {categories.map((c) => (
        <span
          key={c}
          title={LABEL[c]}
          className={`dot dot-${c}`}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}
