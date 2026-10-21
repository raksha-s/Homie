import { Plus } from "@phosphor-icons/react";

/** Floating add button. Sits above the bottom nav and respects the home-indicator safe area. */
export default function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pressable fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg"
      style={{ bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <Plus size={28} weight="bold" aria-hidden="true" />
    </button>
  );
}
