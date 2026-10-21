import type { ISODate } from "../../lib/dates";

export type InventoryItem = {
  id: string;
  name: string;
  over_on: ISODate | null;
  restock_task_id: string | null;
  created_at: string;
};

export type Restock = {
  id: string;
  item_id: string;
  restock_date: ISODate;
  created_at: string;
};
