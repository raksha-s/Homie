import type { ReactNode } from "react";
import { SignOut } from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";

export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { signOut } = useAuth();
  return (
    <header className="mb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="pressable -mr-2 grid size-11 place-items-center rounded-full text-muted"
        >
          <SignOut size={22} aria-hidden="true" />
        </button>
      </div>
      {children}
    </header>
  );
}
