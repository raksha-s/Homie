import type { ReactNode } from "react";

/**
 * A thin progress ring around its content. No ring at all when there is nothing to measure
 * (an empty day or a day still ahead). The same figure is always available as text elsewhere,
 * so the ring is never the only signal.
 */
export default function Ring({
  percent,
  size = 38,
  stroke = 3,
  children,
}: {
  percent: number | null;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      {percent !== null ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          {percent > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(c * percent) / 100} ${c}`}
            />
          ) : null}
        </svg>
      ) : null}
      {children}
    </span>
  );
}
