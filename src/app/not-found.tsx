import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found · Groundtruth",
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-4 bg-paper px-4 sm:px-8 md:px-[12vw]">
      <p className="eyebrow tnum text-ink-muted">404</p>
      <h1 className="font-wide text-headline text-ink">There’s no page at this address</h1>
      <p className="max-w-[52ch] text-body text-ink-muted">
        The link may be mistyped or out of date. Look up a building from the start page, or read how results are computed.
      </p>
      <div className="flex gap-4 text-ui">
        <Link href="/" className="link text-ink">
          Look up an address
        </Link>
        <Link href="/method" className="link text-ink">
          How it works
        </Link>
      </div>
    </main>
  );
}
