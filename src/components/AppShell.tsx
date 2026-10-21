import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import { TasksProvider } from "../features/tasks/TasksProvider";

export default function AppShell() {
  return (
    <TasksProvider>
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
      <main
        id="main"
        className="flex-1 px-4 pt-[calc(16px+env(safe-area-inset-top,0px))]"
        style={{ paddingBottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
    </TasksProvider>
  );
}
