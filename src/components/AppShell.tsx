import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import VersionFooter from "./VersionFooter";
import { TasksProvider } from "../features/tasks/TasksProvider";
import { KitchenProvider } from "../features/kitchen/KitchenProvider";
import { InventoryProvider } from "../features/inventory/InventoryProvider";

export default function AppShell() {
  return (
    <TasksProvider>
    <InventoryProvider>
    <KitchenProvider>
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
      <main
        id="main"
        className="flex-1 px-4 pt-[calc(16px+env(safe-area-inset-top,0px))]"
        style={{ paddingBottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        <Outlet />
        <VersionFooter />
      </main>
      <BottomNav />
    </div>
    </KitchenProvider>
    </InventoryProvider>
    </TasksProvider>
  );
}
