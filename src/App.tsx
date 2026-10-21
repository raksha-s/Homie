import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import TasksPage from "./pages/TasksPage";
import CalendarPage from "./pages/CalendarPage";
import KitchenPage from "./pages/KitchenPage";
import InventoryPage from "./pages/InventoryPage";
import FinancePage from "./pages/FinancePage";
import SignInPage from "./pages/SignInPage";
import { useAuth } from "./auth/AuthProvider";

export default function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-dvh" aria-busy="true" />;
  if (!session) return <SignInPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/main/tasks" replace />} />
        <Route path="/main/tasks" element={<TasksPage />} />
        <Route path="/main/calendar" element={<CalendarPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="*" element={<Navigate to="/main/tasks" replace />} />
      </Route>
    </Routes>
  );
}
