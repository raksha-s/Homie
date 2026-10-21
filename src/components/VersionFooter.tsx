import { useState } from "react";

/** Which build is running, plus a way to force the newest one when a phone holds on to an old copy. */
export default function VersionFooter() {
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } finally {
      window.location.reload();
    }
  };

  return (
    <footer className="mt-10 flex items-center justify-center gap-3 text-xs text-muted">
      <span className="tabular-nums">Version {__BUILD__}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void refresh()}
        className="pressable min-h-11 px-2 font-medium underline"
      >
        {busy ? "Refreshing…" : "Refresh app"}
      </button>
    </footer>
  );
}
