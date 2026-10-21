import { NavLink, useLocation } from "react-router-dom";
import { CalendarCheck, CookingPot, Package, Wallet } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

type Item = { to: string; match: string; label: string; icon: Icon; badge?: number };

const items: Item[] = [
  { to: "/main/tasks", match: "/main", label: "Main", icon: CalendarCheck },
  { to: "/kitchen", match: "/kitchen", label: "Kitchen", icon: CookingPot },
  { to: "/inventory", match: "/inventory", label: "Inventory", icon: Package },
  { to: "/finance", match: "/finance", label: "Finance", icon: Wallet },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-[640px]" style={{ height: "var(--nav-height)" }}>
        {items.map(({ to, match, label, icon: IconCmp, badge }) => {
          const isActive = pathname.startsWith(match);
          return (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={`pressable relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                isActive ? "text-accent-strong" : "text-muted"
              }`}
            >
              <>
                  <span className="relative">
                    <IconCmp size={26} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                    {badge ? (
                      <span
                        className="absolute -right-2 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 text-bg"
                        aria-label={`${badge} reminders`}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </span>
                  {label}
              </>
            </NavLink>
          </li>
          );
        })}
      </ul>
    </nav>
  );
}
