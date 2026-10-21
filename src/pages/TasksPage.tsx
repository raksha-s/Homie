import { useState } from "react";
import PageHeader from "../components/PageHeader";
import SubTabs from "../components/SubTabs";
import Fab from "../components/Fab";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";

export const mainTabs = [
  { to: "/main/tasks", label: "My Tasks" },
  { to: "/main/calendar", label: "Calendar" },
];

export default function TasksPage() {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader title="Homie" />
      <SubTabs tabs={mainTabs} label="Main sections" />
      <EmptyState title="Nothing planned yet">
        Tap the plus button to add your first task. Tasks you add show up here for the day.
      </EmptyState>
      <Fab label="Add task" onClick={() => setAdding(true)} />
      <BottomSheet
        open={adding}
        onOpenChange={setAdding}
        title="Add task"
        description="The task form arrives in the next build step."
      >
        <p className="text-muted">Name, category, frequency, time and calendar options will live here.</p>
      </BottomSheet>
    </>
  );
}
