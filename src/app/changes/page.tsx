import type { Metadata } from "next";
import Link from "next/link";
import { ArrowSquareOutIcon, FlagIcon } from "@phosphor-icons/react/dist/ssr";
import { CHANGE_TESTS, groupByCity, type ChangeTest } from "@/lib/change-tests";
import { formatDate } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Who each law change affects · Groundtruth",
  description: "The five change tests T1 to T5: which sample buildings each law change reaches, and where conflicts need review.",
};

function safeUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function Share({ n, total }: { n: number; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="tnum flex items-baseline gap-1 font-mono text-ink">
        <span className="text-headline font-bold">{n}</span>
        <span className="text-ui text-ink-muted">/ {total} addresses</span>
      </div>
      <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-hairline" aria-hidden>
        <div className="absolute inset-y-0 left-0 origin-left bg-accent" style={{ width: `${(n / total) * 100}%` }} />
      </div>
    </div>
  );
}

function TestSection({ t }: { t: ChangeTest }) {
  const groups = groupByCity(t.affected);
  return (
    <section id={t.id} aria-labelledby={`${t.id}-title`} className="grid scroll-mt-8 gap-6 border-t border-hairline pt-8 md:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-3">
        <span className="tnum font-mono text-[0.75rem] text-accent">{t.id}</span>
        <h2 id={`${t.id}-title`} className="text-title font-bold text-ink">
          {t.title}
        </h2>
        <p className="text-ui text-ink-muted">{t.question}</p>
        <dl className="tnum flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.75rem] text-ink-muted">
          {t.before && (
            <div className="flex gap-1.5">
              <dt>Before</dt>
              <dd className="text-ink">{t.before}</dd>
            </div>
          )}
          <div className="flex gap-1.5">
            <dt>{t.before ? "After" : "As of"}</dt>
            <dd className="text-ink">{t.after}</dd>
          </div>
        </dl>
        <ul className="flex flex-col gap-1">
          {t.rules.map((r) => {
            const href = safeUrl(r.source_url);
            return (
              <li key={r.team_rule_id} className="text-caption text-ink">
                <span className="font-mono text-ink-muted">{r.team_rule_id}</span> {r.title}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link ml-1.5 inline-flex items-center gap-1 font-mono text-[0.75rem]">
                    {r.citation}
                    <ArrowSquareOutIcon size={11} aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-caption text-ink-muted">{t.notes}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-8">
          <Share n={t.affected.length} total={t.total} />
          <div className="flex flex-col gap-0.5">
            <span className={`tnum flex items-center gap-1.5 font-mono text-headline font-bold ${t.conflicts.size ? "text-accent-ink" : "text-ink"}`}>
              {t.conflicts.size > 0 && <FlagIcon size={16} weight="fill" aria-hidden />}
              {t.conflicts.size}
            </span>
            <span className="text-ui text-ink-muted">flagged for review</span>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-[var(--radius-chip)] bg-surface-sunk px-3 py-2 text-ui text-ink">No sample address is affected. This is the expected answer for this test.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline rounded-[var(--radius-control)] bg-surface shadow-[0_0_0_1px_var(--hairline)]">
            {groups.map(([city, list]) => (
              <li key={city}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-ui text-ink hover:bg-surface-sunk">
                    <span className="font-bold">{city}</span>
                    <span className="tnum font-mono text-[0.75rem] text-ink-muted">
                      {list.length}
                      {list.some((a) => t.conflicts.has(a.address_id)) && <span className="text-accent-ink"> · flagged</span>}
                    </span>
                  </summary>
                  <ul className="grid gap-x-4 px-4 pb-3 sm:grid-cols-2">
                    {list.map((a) => (
                      <li key={a.address_id} className="flex items-center gap-2 py-1 text-caption">
                        <Link href={`/?a=${a.address_id}&asOf=${t.after}`} className="link truncate text-ink">
                          {a.street_address}
                        </Link>
                        {t.conflicts.has(a.address_id) && <FlagIcon size={11} weight="fill" className="shrink-0 text-accent" aria-label="flagged for review" />}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function ChangesPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="font-wide text-[0.9375rem] text-ink">
          Groundtruth
        </Link>
        <nav className="flex gap-5 text-ui">
          <Link href="/new-law" className="link text-ink">
            Test a new law
          </Link>
          <Link href="/method" className="link text-ink">
            How it works
          </Link>
          <Link href="/" className="link text-ink">
            Look up an address
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
        <section className="flex max-w-[62ch] flex-col gap-4">
          <p className="eyebrow text-ink-muted">Change tracking</p>
          <h1 className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.02em] text-ink">Who each change affects</h1>
          <p className="text-title text-ink-muted">
            Five law changes, run through the same engine as every lookup. Each one lists the sample buildings whose result changes, grouped by legal city. Open
            any address to see it on the date the change applies.
          </p>
          <nav aria-label="Tests" className="flex flex-wrap gap-1.5">
            {CHANGE_TESTS.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="tnum rounded-[var(--radius-chip)] bg-surface-sunk px-2 py-1 font-mono text-[0.75rem] text-ink shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-surface">
                {t.id} · {t.affected.length}
              </a>
            ))}
          </nav>
        </section>

        {CHANGE_TESTS.map((t) => (
          <TestSection key={t.id} t={t} />
        ))}
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-4 py-6 font-mono text-[0.75rem] text-ink-muted sm:px-8">
          Not legal advice · Sources: public law as retrieved 2026-10-01 · Default query date {formatDate("2026-10-01")}
        </div>
      </footer>
    </div>
  );
}
