import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function InventoryPage() {
  return (
    <>
      <PageHeader title="Inventory" />
      <EmptyState title="No items tracked yet">
        Add things like toilet paper or detergent to track how long each one lasts.
      </EmptyState>
    </>
  );
}
