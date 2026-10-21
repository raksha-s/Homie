import { useEffect, useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import { formatDayShort, type ISODate } from "../../lib/dates";
import type { InventoryItem } from "./types";

/** Asked every time something is restocked, from Inventory or from the Shopping List task. */
export default function RestockSheet({
  item,
  previous,
  today,
  onConfirm,
  onClose,
}: {
  item: InventoryItem | null;
  previous: ISODate | null;
  today: ISODate;
  onConfirm: (date: ISODate) => Promise<boolean>;
  onClose: () => void;
}) {
  const [date, setDate] = useState<ISODate>(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setDate(today);
      setError(null);
    }
  }, [item, today]);

  const submit = async () => {
    if (date > today) return setError("That date is in the future. Pick today or an earlier day.");
    if (previous && date <= previous) return setError(`Pick a day after the last restock on ${formatDayShort(previous)}.`);
    setBusy(true);
    const ok = await onConfirm(date);
    setBusy(false);
    if (!ok) setError("Could not save that. Try again.");
  };

  return (
    <BottomSheet
      open={Boolean(item)}
      onOpenChange={(o) => !o && onClose()}
      title={item ? `Restocked ${item.name}` : "Restocked"}
      description="When did you restock it? This sets how long the last one lasted."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="restock-date" className="mb-2 block text-sm font-medium">
            Restocked on
          </label>
          <input
            id="restock-date"
            type="date"
            className="input"
            value={date}
            max={today}
            min={previous ?? undefined}
            onChange={(e) => e.target.value && (setDate(e.target.value), setError(null))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "restock-error" : undefined}
          />
          {error ? (
            <p id="restock-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-success flex-1">
            {busy ? "Saving…" : "Save restock"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
