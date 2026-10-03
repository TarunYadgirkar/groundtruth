import { unitRange } from "@/lib/engine";
import { landUseLabel } from "@/lib/display";
import type { Address } from "@/lib/types";

interface Fact {
  label: string;
  value: string | null;
  note?: string | null;
  title?: string;
}

function unitsValue(a: Address): Pick<Fact, "value" | "note"> {
  if (a.units) return { value: String(a.units) };
  const r = unitRange(a);
  if (r.min == null && r.max == null) return { value: null };
  const span = r.max == null ? `${r.min}+` : r.min === r.max ? `${r.min}` : `${r.min ?? 1}–${r.max}`;
  return { value: span, note: "from use code" };
}

const ENTERED = "you entered";

function factsFor(a: Address, record: Address): Fact[] {
  const use = landUseLabel(a);
  const units = unitsValue(a);
  return [
    { label: "Built", value: a.year_built ? String(a.year_built) : null, note: a.year_built && !record.year_built ? ENTERED : null },
    { label: "Units", value: units.value, note: a.units && !record.units ? ENTERED : units.note },
    { label: "Use", value: use?.label ?? null, note: use?.code ?? null, title: use ? [use.label, use.code, a.use_description].filter(Boolean).join(" · ") : undefined },
  ];
}

export default function BuildingFacts({ address, record }: { address: Address; record: Address }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Building facts from public records">
      {factsFor(address, record).map((f) =>
        f.value ? (
          <li
            key={f.label}
            data-value={f.value}
            title={f.title}
            className="flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-[var(--radius-chip)] bg-surface-sunk px-2 text-caption text-ink shadow-[inset_0_0_0_1px_var(--hairline)]"
          >
            <span className="eyebrow shrink-0 text-ink-muted">{f.label}</span>
            <span className="tnum shrink-0">{f.value}</span>
            {f.note && <span className="min-w-0 truncate font-mono text-[0.6875rem] text-ink-muted">{f.note}</span>}
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
