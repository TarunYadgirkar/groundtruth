import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import type { AffectedAddress } from "@/lib/ingest";
import { STATUS_LABEL } from "@/lib/labels";
import type { LookupResult } from "@/lib/types";
import { STATUS_STYLE } from "../panel/StatusPill";

function Result({ r }: { r: LookupResult | "not_covered" }) {
  if (r === "not_covered") return <span className="text-ink-muted">not covered</span>;
  return (
    <span className="whitespace-nowrap rounded-full px-1.5 font-bold" style={{ backgroundColor: STATUS_STYLE[r].bg, color: STATUS_STYLE[r].fg }}>
      {STATUS_LABEL[r]}
    </span>
  );
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function byCity(list: AffectedAddress[]): [string, AffectedAddress[]][] {
  const m = new Map<string, AffectedAddress[]>();
  for (const a of list) {
    const key = `${a.legal_city ?? "Unknown city"}, ${a.state}`;
    m.set(key, [...(m.get(key) ?? []), a]);
  }
  return [...m.entries()].sort((x, y) => y[1].length - x[1].length);
}

export default function AffectedList({ affected, afterDate }: { affected: AffectedAddress[]; afterDate: string }) {
  if (affected.length === 0) return <p className="text-ui text-ink-muted">No sample building changes result under this law.</p>;
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-[var(--radius-control)] bg-surface shadow-[0_0_0_1px_var(--hairline)]">
      {byCity(affected).map(([city, list], i) => (
        <li key={city}>
          <details open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-ui text-ink hover:bg-surface-sunk">
              <span className="font-bold">{city}</span>
              <span className="tnum font-mono text-[0.75rem] text-ink-muted">{list.length}</span>
            </summary>
            <ul className="flex flex-col px-4 pb-3">
              {list.map((a) => (
                <li key={a.address_id} className="flex flex-col gap-1 border-t border-hairline py-2 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/?a=${a.address_id}&asOf=${afterDate}`} className="link w-fit text-caption text-ink">
                    {titleCase(a.street_address)}
                  </Link>
                  <div className="flex flex-col gap-1 sm:items-end">
                    {a.changes.map((c) => (
                      <span key={c.team_rule_id} className="flex flex-wrap items-center gap-1.5 text-[0.75rem]">
                        <Result r={c.now} />
                        <ArrowRightIcon size={11} aria-label="becomes" className="text-ink-muted" />
                        <Result r={c.after} />
                        <span className="tnum font-mono text-ink-muted">on {afterDate}</span>
                      </span>
                    ))}
                    {a.superseded_existing.length > 0 && (
                      <span className="text-[0.75rem] text-ink-muted">Supersedes {a.superseded_existing.length} existing rule{a.superseded_existing.length === 1 ? "" : "s"}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
