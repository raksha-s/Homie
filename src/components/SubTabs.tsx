import { NavLink } from "react-router-dom";

export type SubTab = { to: string; label: string };

/** Top-of-page switcher used on Main (My Tasks, Calendar) and later on Finance. */
export default function SubTabs({ tabs, label }: { tabs: SubTab[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 flex gap-1 rounded-[var(--radius-control)] bg-sunken p-1">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `pressable flex-1 rounded-[10px] px-3 py-2 text-center text-sm font-medium ${
              isActive ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
