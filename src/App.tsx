import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import MainPage from "./pages/MainPage";
import KitchenPage from "./pages/KitchenPage";
import InventoryPage from "./pages/InventoryPage";
import FinancePage from "./pages/FinancePage";
import SignInPage from "./pages/SignInPage";
import { useAuth } from "./auth/AuthProvider";

/** Old links to My Tasks and Calendar land on Main, keeping the date. */
function OldMainLink() {
  const { search } = useLocation();
  const p = new URLSearchParams(search);
  const date = p.get("date");
  if (date) {
    p.delete("date");
    p.set("on", date);
  }
  const qs = p.toString();
  return <Navigate to={`/main${qs ? `?${qs}` : ""}`} replace />;
}

export default function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-dvh" aria-busy="true" />;
  if (!session) return <SignInPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/main" replace />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/main/tasks" element={<OldMainLink />} />
        <Route path="/main/calendar" element={<OldMainLink />} />
        <Route path="/kitchen" element={<Navigate to="/kitchen/plan" replace />} />
        <Route path="/kitchen/plan" element={<KitchenPage tab="plan" />} />
        <Route path="/kitchen/foods" element={<KitchenPage tab="foods" />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="*" element={<Navigate to="/main" replace />} />
      </Route>
    </Routes>
  );
}
