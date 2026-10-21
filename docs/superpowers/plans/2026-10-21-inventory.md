# Inventory Implementation Plan

**Goal:** Track household items, mark them over/restocked, and predict when each runs out (PLAN.md, Phase 4).

**Architecture:** Pure maths in `features/inventory/stats.ts` (tested). An `InventoryProvider` inside `TasksProvider` owns items + restocks in Supabase and drives the Shopping List task. A single `toggleDone` wrapper routes ticks on inventory-made tasks through the restock-date sheet, from My Tasks and Calendar alike.

**Spec:** `PLAN.md` Phase 4. Defaults chosen here: prediction uses the most recent gap (as specified); restock date must be after the previous restock and not in the future; undo of a restock puts the item back to "over" and re-opens its Shopping List task.

## Global constraints
- Free stack only; no schema change (tables exist in `0001_init.sql`).
- Mark as over → Shopping List task (`category:'restock'`, `source:'inventory'`, `source_ref:<item id>`) on the coming Saturday.
- Restocked always asks for the date first (default today).
- One restock → "Needs one more restock to predict".

## Review focus
- Task deleted by hand while item is "over": item must still be restockable.
- Un-ticking an inventory task must undo the restock, not leave a stray record.
- Restock dated before the previous one, or in the future: rejected with a clear message.
- Item added with a "last restocked" date counts as its first restock.
- Prediction already past: "Overdue by N days", not a negative number.

### Task 1: Prediction maths (TDD) — `src/features/inventory/stats.ts`, `inventory.test.ts`
Produces `itemStats(item, restocks, today): { state: 'in_stock'|'over'; lastRestock: ISODate|null; daysLasted: number|null; predictedOn: ISODate|null; daysLeft: number|null }` and `describeLeft(daysLeft): string`.

### Task 2: Provider — `InventoryProvider.tsx`
`items`, `restocks`, `addItem(name, lastRestocked?)`, `renameItem`, `deleteItem`, `markOver`, `markRestocked(itemId, date)`, `undo(itemId)`, `toggleDone(inst)`; renders the restock-date sheet. `TasksProvider` gains `addTask(input): Promise<Task|null>`.

### Task 3: Screen — `InventoryPage.tsx`, sheets, green button token.

### Task 4: Wire ticks in `TasksPage` and `CalendarPage` to `toggleDone`; run tests; deploy.
