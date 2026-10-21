import { useEffect, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Fab from "../components/Fab";
import BottomSheet from "../components/BottomSheet";
import { formatDay, formatDayShort, todayISO, type ISODate } from "../lib/dates";
import { useTasks } from "../features/tasks/TasksProvider";
import { useInventory } from "../features/inventory/InventoryProvider";
import { describeLeft, itemStats } from "../features/inventory/stats";
import type { InventoryItem } from "../features/inventory/types";

export default function InventoryPage() {
  const inv = useInventory();
  const { tasks } = useTasks();
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const withBusy = async (id: string, fn: () => Promise<boolean>) => {
    setBusyId(id);
    await fn();
    setBusyId(null);
  };

  return (
    <>
      <PageHeader title="Inventory" />

      {inv.error ? (
        <p role="alert" className="mb-4 rounded-[var(--radius-control)] bg-sunken px-4 py-3 text-sm text-danger">
          {inv.error}{" "}
          <button type="button" className="font-semibold underline" onClick={() => void inv.reload()}>
            Try again
          </button>{" "}
          <button type="button" className="font-semibold underline" onClick={inv.clearError}>
            Dismiss
          </button>
        </p>
      ) : null}

      {inv.loading ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-[var(--radius-card)] bg-sunken motion-reduce:animate-none" />
          ))}
        </div>
      ) : inv.items.length === 0 ? (
        <EmptyState title="No items tracked yet">
          Add things like toilet paper or detergent. Mark them as over when they run out, and Homie learns how long each one lasts.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {inv.items.map((item) => {
            const s = itemStats(item, inv.restocks, today);
            const task = tasks.find((t) => t.id === item.restock_task_id);
            const over = s.state === "over";
            const canUndoRestock = !over && item.restock_task_id !== null && s.lastRestock !== null;
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-lg font-semibold">{item.name}</h2>
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="pressable -mr-2 -mt-1 min-h-11 shrink-0 rounded-full px-3 text-sm font-medium text-muted"
                    aria-label={`Edit ${item.name}`}
                  >
                    Edit
                  </button>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">Last restocked</dt>
                    <dd className="font-medium tabular-nums">{s.lastRestock ? formatDayShort(s.lastRestock) : "Not yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Lasted</dt>
                    <dd className="font-medium tabular-nums">
                      {s.daysLasted !== null ? `${s.daysLasted} ${s.daysLasted === 1 ? "day" : "days"}` : "Not enough data"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-sm" aria-live="polite">
                  {over
                    ? task
                      ? `On your Shopping List for ${formatDay(task.start_date)}`
                      : "Marked as over. Restock it when you have bought more."
                    : s.daysLeft !== null
                      ? describeLeft(s.daysLeft)
                      : s.lastRestock
                        ? "Needs one more restock to predict"
                        : "Needs two restocks to predict"}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  {over ? (
                    <button type="button" disabled={busy} className="btn-success flex-1" onClick={() => inv.askRestock(item.id)}>
                      Mark as restocked
                    </button>
                  ) : (
                    <button type="button" disabled={busy} className="btn-danger flex-1" onClick={() => void withBusy(item.id, () => inv.markOver(item.id))}>
                      Mark as over
                    </button>
                  )}
                  {over || canUndoRestock ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="btn-secondary inline-flex items-center gap-1.5"
                      onClick={() => void withBusy(item.id, () => inv.undo(item.id))}
                    >
                      <ArrowCounterClockwise size={18} aria-hidden="true" />
                      Undo
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Fab label="Add item" onClick={() => setAdding(true)} />
      <AddItemSheet open={adding} today={today} onClose={() => setAdding(false)} />
      <EditItemSheet item={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function AddItemSheet({ open, today, onClose }: { open: boolean; today: ISODate; onClose: () => void }) {
  const inv = useInventory();
  const [name, setName] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setLast("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const n = name.trim();
    if (!n) return setError("Give the item a name.");
    if (inv.items.some((i) => i.name.toLowerCase() === n.toLowerCase())) return setError("You already track an item with that name.");
    setBusy(true);
    const ok = await inv.addItem(n, last || null);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Add an item">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="item-name" className="mb-2 block text-sm font-medium">
            Item
          </label>
          <input
            id="item-name"
            className="input"
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => (setName(e.target.value), setError(null))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "item-error" : undefined}
          />
          {error ? (
            <p id="item-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="item-last" className="mb-2 block text-sm font-medium">
            Last restocked on (optional)
          </label>
          <input id="item-last" type="date" className="input" value={last} max={today} onChange={(e) => setLast(e.target.value)} />
          <p className="mt-2 text-sm text-muted">If you know it, Homie can predict sooner.</p>
        </div>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Adding…" : "Add item"}
        </button>
      </form>
    </BottomSheet>
  );
}

function EditItemSheet({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const inv = useInventory();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setConfirming(false);
    }
  }, [item]);

  if (!item) return <BottomSheet open={false} onOpenChange={() => undefined} title="Edit item">{null}</BottomSheet>;

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const ok = n === item.name ? true : await inv.renameItem(item.id, n);
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async () => {
    setBusy(true);
    const ok = await inv.deleteItem(item.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit item"
      description={confirming ? `Delete ${item.name} and its restock history? This cannot be undone.` : undefined}
    >
      {confirming ? (
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={() => setConfirming(false)}>
            Keep it
          </button>
          <button type="button" disabled={busy} className="btn-danger flex-1" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <label htmlFor="edit-name" className="mb-2 block text-sm font-medium">
              Item
            </label>
            <input id="edit-name" className="input" value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" disabled={busy || !name.trim()} className="btn-primary">
            Save
          </button>
          <button type="button" className="min-h-11 font-medium text-danger" onClick={() => setConfirming(true)}>
            Delete item
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
