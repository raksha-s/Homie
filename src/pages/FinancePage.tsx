import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function FinancePage() {
  return (
    <>
      <PageHeader title="Finance" />
      <EmptyState title="No expenses yet">
        Log an expense, review it in a session, then send it to your Google Sheet.
      </EmptyState>
    </>
  );
}
