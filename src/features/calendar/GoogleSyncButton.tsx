import { useEffect, useRef, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { googleConfigured } from "../../lib/google";
import { useTasks } from "../tasks/TasksProvider";

/** Pulls the next two weeks of Google Calendar into Homie. An icon beside sign-out; the result shows as a short message. */
export default function GoogleSyncButton({ notify }: { notify: (message: string) => void }) {
  const t = useTasks();
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);

  // The result arrives as a change to lastImport; only announce it for a sync started from this button.
  useEffect(() => {
    const last = t.lastImport;
    if (!last || !asked.current) return;
    asked.current = false;
    notify(
      last.count === 0 && last.converted === 0
        ? "Google Calendar is already up to date"
        : [
            last.count ? `Added ${last.count} ${last.count === 1 ? "event" : "events"} from Google Calendar` : "",
            last.converted ? `Turned ${last.converted} into ${last.converted === 1 ? "a birthday" : "birthdays"}` : "",
          ]
            .filter(Boolean)
            .join(". "),
    );
  }, [t.lastImport?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!googleConfigured) return null;

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={busy ? "Syncing Google Calendar" : "Sync Google Calendar"}
      title="Sync Google Calendar"
      onClick={async () => {
        asked.current = true;
        setBusy(true);
        const ok = await t.importFromGoogle();
        setBusy(false);
        if (!ok) asked.current = false;
      }}
      className="pressable grid size-11 place-items-center rounded-full text-muted"
    >
      <ArrowsClockwise size={22} aria-hidden="true" className={busy ? "animate-spin motion-reduce:animate-none" : ""} />
    </button>
  );
}
