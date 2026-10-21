import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function KitchenPage() {
  return (
    <>
      <PageHeader title="Kitchen" />
      <EmptyState title="Your weekly meal plan">
        Add the dishes, fruits and snacks you can make, then generate a plan for the week.
      </EmptyState>
    </>
  );
}
