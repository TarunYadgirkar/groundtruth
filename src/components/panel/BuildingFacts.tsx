import type { Address } from "@/lib/types";

interface Fact {
  label: string;
  value: string | null;
}

function factsFor(a: Address): Fact[] {
  return [
    { label: "Built", value: a.year_built ? String(a.year_built) : null },
    { label: "Units", value: a.units ? String(a.units) : null },
    { label: "Use", value: a.use_description || null },
  ];
}

export default function BuildingFacts({ address }: { address: Address }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Building facts from public records">
      {factsFor(address).map((f) =>
        f.value ? (
          <li key={f.label} className="flex h-7 items-center gap-1.5 rounded-[var(--radius-chip)] bg-surface-sunk px-2 text-caption text-ink shadow-[inset_0_0_0_1px_var(--hairline)]">
            <span className="eyebrow text-ink-muted">{f.label}</span>
            <span className="tnum max-w-[22ch] truncate" title={f.value}>
              {f.value}
            </span>
          </li>
        ) : (
          <li
            key={f.label}
            className="flex h-7 items-center gap-1.5 rounded-[var(--radius-chip)] px-2 text-caption text-ink-muted outline-1 -outline-offset-1 outline-dashed outline-hairline-strong"
          >
            <span className="eyebrow">{f.label}</span>
            <span>not in records</span>
          </li>
        ),
      )}
    </ul>
  );
}
