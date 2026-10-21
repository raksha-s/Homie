import type { ReactNode } from "react";

export default function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-dashed border-line px-5 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? <p className="mx-auto mt-2 max-w-[36ch] text-muted">{children}</p> : null}
    </section>
  );
}
