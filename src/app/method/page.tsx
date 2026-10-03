import type { Metadata } from "next";
import Link from "next/link";
import { METHOD_STATS as S } from "@/lib/method-stats";

export const metadata: Metadata = {
  title: "How Groundtruth works",
  description: "How Groundtruth turns public housing law into address-level answers, and where it falls short.",
};

const pct = (n: number | null) => (n === null ? null : `${Math.round(n * 100)}%`);
const num = (n: number | null) => (n === null ? null : n.toLocaleString("en-US"));

const STEPS = [
  {
    name: "Extract",
    body: "Claude reads each official document in the corpus and writes structured rule records: who is covered, from when, and the exact sentence that says so.",
    stat: [num(S.rulesExtracted), "rule records"] as const,
    link: { href: "/new-law", label: "Try it on a new law" },
  },
  {
    name: "Verify quotes",
    body: "Every quoted sentence must appear word for word in the source text. Records whose quote can't be found are dropped and logged, never patched by hand.",
    stat: [num(S.quotesChecked), "quotes checked"] as const,
  },
  {
    name: "Geocode",
    body: "The Census geocoder places each address in its legal city. A Dorchester mailing address is in Boston; a Van Nuys address is in Los Angeles.",
    stat: [`${num(S.addressesGeocoded)} of ${num(S.addressesTotal)}`, "addresses placed"] as const,
  },
  {
    name: "Rules engine",
    body: "Deterministic code, no model: match jurisdiction, check status and effective date, test coverage against building facts, then resolve which level governs.",
    stat: ["0", "model calls per lookup"] as const,
  },
  {
    name: "Lookups and changes",
    body: "The same engine answers any address on any date. Moving the date slider re-runs it in your browser, which is how the change tests are produced.",
    stat: ["5", "change tests"] as const,
    link: { href: "/changes", label: "See who each change affects" },
  },
];

const COMMITMENTS = [
  ["Show the source", "Every result carries its citation, the exact quoted text, a link to the source and the date we retrieved it."],
  ["Say unknown", "When a rule depends on a fact the public records lack (year built, unit count, who owns the building) the answer is unknown, with the missing fact named."],
  ["Separate law from proposals", "Pending bills sit in their own section and never count as applying. Enacted laws that start later are marked not yet in effect."],
  ["Flag conflicts", "Where two laws may collide, such as a state act that preempts local ordinances, both are flagged for human review instead of picking a winner."],
  ["Never advise", "Groundtruth describes what public law says. It doesn't tell anyone how to avoid a rule and isn't a compliance certification."],
] as const;

const LIMITS = [
  "The corpus is 87 documents across three states and nine cities. Laws outside it are invisible to the tool, so “no rule found” means none in this corpus.",
  "Building facts come from assessor records, which miss construction years and unit counts for many New Jersey, Berkeley and Boston buildings.",
  "Year built isn't the certificate-of-occupancy date. Buildings finished in a cutoff year come back unknown.",
  "Owner names are excluded, so small-landlord exemptions can't be resolved.",
  "Addresses looked up live (outside the sample) get city and state rules only; their building facts stay unknown.",
  "The assistant answers only from the rule records shown for the address. It can still word things imperfectly; the rule list is the record.",
];

function Stat({ value, label }: { value: string | null; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      {value === null ? (
        <span className="w-fit rounded-[var(--radius-chip)] px-1.5 font-mono text-ui text-ink-muted outline-1 -outline-offset-1 outline-dashed outline-hairline-strong">
          pending
        </span>
      ) : (
        <span className="tnum font-mono text-title font-bold text-ink">{value}</span>
      )}
      <span className="text-caption text-ink-muted">{label}</span>
    </div>
  );
}

export default function MethodPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="font-wide text-[0.9375rem] text-ink">
          Groundtruth
        </Link>
        <Link href="/" className="link text-ui text-ink">
          Look up an address
        </Link>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-20 px-4 pb-24 pt-12 sm:px-8 sm:pt-20">
        <section className="flex max-w-[62ch] flex-col gap-4">
          <p className="eyebrow text-ink-muted">Method</p>
          <h1 className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.02em] text-ink">How Groundtruth works</h1>
          <p className="text-title text-ink-muted">
            Groundtruth answers one question: which rental housing laws apply at this address, on this date. A model reads the law once; plain code answers
            every lookup, so the same address and date always give the same answer.
          </p>
        </section>

        <section aria-labelledby="pipeline" className="flex flex-col gap-6">
          <h2 id="pipeline" className="text-title font-bold text-ink">
            The pipeline
          </h2>
          <ol className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] bg-hairline shadow-[0_0_0_1px_var(--hairline)] md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.name} className="flex flex-col gap-4 bg-surface p-5">
                <span className="tnum font-mono text-[0.75rem] text-accent">0{i + 1}</span>
                <h3 className="text-body font-bold text-ink">{s.name}</h3>
                <p className="flex-1 text-caption text-ink-muted">{s.body}</p>
                <Stat value={s.stat[0]} label={s.stat[1]} />
                {s.link && (
                  <Link href={s.link.href} className="link text-caption text-ink">
                    {s.link.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="sr-only">Quotes dropped</dt>
              <dd>
                <Stat value={num(S.quotesDropped)} label="records dropped for unverifiable quotes" />
              </dd>
            </div>
            <div>
              <dt className="sr-only">Precision</dt>
              <dd>
                <Stat value={pct(S.precision)} label={`precision on a hand-labeled check set${S.checkSetSize ? ` of ${S.checkSetSize}` : ""}`} />
              </dd>
            </div>
            <div>
              <dt className="sr-only">Recall</dt>
              <dd>
                <Stat value={pct(S.recall)} label="recall on the same check set" />
              </dd>
            </div>
            <div>
              <dt className="sr-only">Sources retrieved</dt>
              <dd>
                <Stat value={S.retrievedOn} label="date sources were retrieved" />
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="commitments" className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <h2 id="commitments" className="text-title font-bold text-ink">
            Responsible design
          </h2>
          <ul className="flex flex-col divide-y divide-hairline">
            {COMMITMENTS.map(([title, body]) => (
              <li key={title} className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <span className="text-ui font-bold text-ink">{title}</span>
                <span className="max-w-[60ch] text-ui text-ink-muted">{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="limits" className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <h2 id="limits" className="text-title font-bold text-ink">
            Limitations
          </h2>
          <ul className="flex max-w-[64ch] flex-col gap-3">
            {LIMITS.map((l) => (
              <li key={l} className="flex gap-3 text-ui text-ink-muted">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-faint" />
                {l}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 font-mono text-[0.75rem] text-ink-muted sm:flex-row sm:justify-between sm:px-8">
          <span>Not legal advice · Sources: public law as retrieved {S.retrievedOn}</span>
          <span>Extraction model: {S.model}</span>
        </div>
      </footer>
    </div>
  );
}
