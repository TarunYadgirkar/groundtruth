import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import NewLaw from "@/components/new-law/NewLaw";

export const metadata: Metadata = {
  title: "Test a new law · Groundtruth",
  description: "Paste an ordinance or bill Groundtruth has never seen. It extracts the rules, verifies every quote, and tests all 500 sample buildings.",
};

const SAMPLE = readFileSync(path.join(process.cwd(), "src/data/sample-ordinance.txt"), "utf8");

export default function NewLawPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="font-wide text-[0.9375rem] text-ink">
          Groundtruth
        </Link>
        <nav className="flex gap-5 text-ui">
          <Link href="/changes" className="link text-ink">
            Change tests
          </Link>
          <Link href="/method" className="link text-ink">
            How it works
          </Link>
        </nav>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
        <section className="flex max-w-[62ch] flex-col gap-4">
          <p className="eyebrow text-ink-muted">New law</p>
          <h1 className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.02em] text-ink">Test a new law</h1>
          <p className="text-title text-ink-muted">
            Paste an ordinance or bill the system has never seen. Claude extracts the rules, every quote is checked word for word against your text, and the
            rules engine tests all 500 sample buildings to show who the law would reach.
          </p>
        </section>
        <NewLaw sample={SAMPLE} />
      </main>
      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-4 py-6 font-mono text-[0.75rem] text-ink-muted sm:px-8">
          Not legal advice · Pasted text is sent to an AI model (Claude) for extraction
        </div>
      </footer>
    </div>
  );
}
