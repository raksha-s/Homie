import PageHeader from "../components/PageHeader";
import SubTabs from "../components/SubTabs";
import EmptyState from "../components/EmptyState";
import { mainTabs } from "./TasksPage";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Homie" />
      <SubTabs tabs={mainTabs} label="Main sections" />
      <EmptyState title="Calendar coming soon">
        Week, month and year views with each day's progress will appear here.
      </EmptyState>
    </>
  );
}
