import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { comingSaturday, todayISO, type ISODate } from "../../lib/dates";
import { useTasks, type TaskInstance } from "../tasks/TasksProvider";
import type { Task } from "../tasks/types";
import RestockSheet from "./RestockSheet";
import type { InventoryItem, Restock } from "./types";

type Ctx = {
  items: InventoryItem[];
  restocks: Restock[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  reload: () => Promise<void>;
  addItem: (name: string, lastRestocked: ISODate | null) => Promise<boolean>;
  renameItem: (id: string, name: string) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  markOver: (id: string) => Promise<boolean>;
  /** Opens the "when did you restock?" sheet for this item. */
  askRestock: (id: string) => void;
  undo: (id: string) => Promise<boolean>;
  /** Tick or untick a task. Shopping List tasks made by Inventory go through the restock sheet instead. */
  toggleDone: (inst: TaskInstance) => void;
};

const InventoryContext = createContext<Ctx | null>(null);

function describe(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const tasks = useTasks();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [restocks, setRestocks] = useState<Restock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const today = todayISO();

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const [a, b] = await Promise.all([
      supabase.from("inventory_items").select("*").order("created_at"),
      supabase.from("restocks").select("*").order("restock_date"),
    ]);
    if (a.error || b.error) setError(describe(a.error ?? b.error));
    else {
      setItems(a.data as InventoryItem[]);
      setRestocks(b.data as Restock[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attempt = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(describe(e));
      return false;
    }
  }, []);

  const patchItem = async (id: string, patch: Partial<InventoryItem>) => {
    const { data, error: err } = await supabase.from("inventory_items").update(patch).eq("id", id).select().single();
    if (err) throw err;
    setItems((prev) => prev.map((i) => (i.id === id ? (data as InventoryItem) : i)));
  };

  const insertRestock = async (item_id: string, restock_date: ISODate) => {
    const { data, error: err } = await supabase.from("restocks").insert({ item_id, restock_date }).select().single();
    if (err) throw err;
    setRestocks((prev) => [...prev, data as Restock]);
  };

  const taskFor = (item: InventoryItem): Task | undefined => tasks.tasks.find((t) => t.id === item.restock_task_id);

  const shoppingTask = (item: InventoryItem) => ({
    title: `Buy ${item.name}`,
    category: "restock" as const,
    time: null,
    start_date: comingSaturday(today),
    recurrence: { type: "once" as const },
    add_to_gcal: false,
    gcal_event_id: null,
    source: "inventory" as const,
    source_ref: item.id,
    target: null,
  });

  const lastRestockOf = (id: string): Restock | undefined =>
    restocks.filter((r) => r.item_id === id).sort((a, b) => a.restock_date.localeCompare(b.restock_date)).at(-1);

  const value: Ctx = {
    items,
    restocks,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    addItem: (name, lastRestocked) =>
      attempt(async () => {
        const { data, error: err } = await supabase.from("inventory_items").insert({ name }).select().single();
        if (err) throw err;
        setItems((prev) => [...prev, data as InventoryItem]);
        if (lastRestocked) await insertRestock((data as InventoryItem).id, lastRestocked);
      }),
    renameItem: (id, name) => attempt(() => patchItem(id, { name })),
    deleteItem: (id) =>
      attempt(async () => {
        const item = items.find((i) => i.id === id);
        const { error: err } = await supabase.from("inventory_items").delete().eq("id", id);
        if (err) throw err;
        setItems((prev) => prev.filter((i) => i.id !== id));
        setRestocks((prev) => prev.filter((r) => r.item_id !== id));
        // Its Shopping List task has no reason to stay once the item is gone.
        const task = item && taskFor(item);
        if (task) await tasks.deleteTask(task, task.start_date, "future");
      }),
    markOver: (id) =>
      attempt(async () => {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        const task = await tasks.addTask(shoppingTask(item));
        if (!task) throw new Error("Could not add it to your Shopping List.");
        await patchItem(id, { over_on: today, restock_task_id: task.id });
      }),
    askRestock: setAsking,
    undo: (id) =>
      attempt(async () => {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        const task = taskFor(item);
        if (item.over_on) {
          // Undo "over": back in stock, and the Shopping List task goes away.
          await patchItem(id, { over_on: null, restock_task_id: null });
          if (task) await tasks.deleteTask(task, task.start_date, "future");
          return;
        }
        // Undo the latest restock: the item is "over" again and its Shopping List task is open again.
        const last = lastRestockOf(id);
        if (!last) return;
        const { error: err } = await supabase.from("restocks").delete().eq("id", last.id);
        if (err) throw err;
        setRestocks((prev) => prev.filter((r) => r.id !== last.id));
        let taskId = task?.id ?? null;
        if (task) await tasks.reopenTask(task);
        else taskId = (await tasks.addTask(shoppingTask(item)))?.id ?? null;
        await patchItem(id, { over_on: today, restock_task_id: taskId });
      }),
    toggleDone: (inst) => {
      const itemId = inst.task.source === "inventory" ? inst.task.source_ref : null;
      const item = itemId ? items.find((i) => i.id === itemId) : undefined;
      if (!item) {
        void tasks.setStatus(inst.task, inst.date, inst.status === "done" ? "pending" : "done");
      } else if (inst.status === "done") {
        void value.undo(item.id);
      } else {
        setAsking(item.id);
      }
    },
  };

  const confirmRestock = async (date: ISODate) => {
    const item = items.find((i) => i.id === asking);
    if (!item) return false;
    const ok = await attempt(async () => {
      await insertRestock(item.id, date);
      const task = taskFor(item);
      if (task) await tasks.setStatus(task, today, "done");
      await patchItem(item.id, { over_on: null });
    });
    if (ok) setAsking(null);
    return ok;
  };

  const askingItem = items.find((i) => i.id === asking) ?? null;

  return (
    <InventoryContext.Provider value={value}>
      {children}
      <RestockSheet
        item={askingItem}
        previous={askingItem ? (lastRestockOf(askingItem.id)?.restock_date ?? null) : null}
        today={today}
        onConfirm={confirmRestock}
        onClose={() => setAsking(null)}
      />
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
}
