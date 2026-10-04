"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon, FileTextIcon, SealCheckIcon, WarningIcon } from "@phosphor-icons/react";
import type { IngestResult } from "@/lib/ingest";
import { CATEGORIES, formatDate } from "@/lib/labels";
import IngestedRuleCard from "./IngestedRuleCard";
import AffectedList from "./AffectedList";

const MIN_CHARS = 200;
const MAX_CHARS = 60_000;
const TICK_MS = 1000;

type State = { kind: "idle" } | { kind: "loading"; started: number } | { kind: "done"; result: IngestResult } | { kind: "error"; message: string };

function useElapsedSeconds(started: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [started]);
  return Math.max(0, Math.floor((now - started) / 1000));
}

function Reading({ started }: { started: number }) {
  const seconds = useElapsedSeconds(started);
  const reduce = useReducedMotion();
  return (
    <p role="status" className="flex items-center gap-2.5 text-ui text-ink">
      <span className="relative grid size-4 place-items-center" aria-hidden>
        <motion.span
          className="absolute inset-[3px] rounded-full bg-accent"
          animate={reduce ? undefined : { scale: [1, 0.7, 1] }}
          transition={{ scale: { repeat: Infinity, duration: 0.9 } }}
        />
      </span>
      Reading the document…
      <span aria-hidden className="tnum font-mono text-[0.75rem] text-ink-muted">
        {seconds} s
      </span>
    </p>
  );
}

function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export default function NewLaw({ sample }: { sample: string }) {
  const ids = { text: useId(), title: useId(), url: useId() };
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const loading = state.kind === "loading";
  const tooShort = text.trim().length < MIN_CHARS;

  const submit = async () => {
    if (tooShort || loading) return;
    setState({ kind: "loading", started: Date.now() });
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, title: title.trim() || undefined, source_url: url.trim() || undefined }),
      });
      const json = (await res.json()) as IngestResult | { error: string };
      if (!res.ok || "error" in json) {
        setState({ kind: "error", message: "error" in json ? json.error : "Something went wrong reading the document." });
        return;
      }
      setState({ kind: "done", result: json });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label htmlFor={ids.text} className="text-ui font-bold text-ink">
            Paste the text of a new ordinance or bill
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setText(sample);
              setTitle("Cambridge Ordinance 2026-T1 (fictional)");
              setUrl("");
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] bg-surface-sunk px-3 text-caption text-ink shadow-[inset_0_0_0_1px_var(--hairline)] transition-[background-color,scale] duration-150 hover:bg-surface active:scale-[0.96] disabled:opacity-50"
          >
            <FileTextIcon size={14} aria-hidden /> Try the sample (fictional Cambridge ordinance)
          </button>
        </div>
        <textarea
          id={ids.text}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHARS}
          rows={12}
          disabled={loading}
          placeholder="SECTION 1. No owner of a residential rental property shall…"
          className="min-h-[240px] w-full resize-y rounded-[var(--radius-control)] bg-surface p-4 font-mono text-[0.8125rem] leading-[1.6] text-ink shadow-[0_0_0_1.5px_var(--ink),var(--shadow-hard)] outline-none placeholder:text-ink-faint focus-visible:shadow-[0_0_0_1.5px_var(--ink),var(--shadow-hard),0_0_0_8px_rgba(200,69,44,0.12)] focus-visible:outline-none disabled:opacity-70"
        />
        <div className="tnum flex justify-between font-mono text-[0.75rem] text-ink-muted">
          <span>{tooShort ? `At least ${MIN_CHARS} characters` : "Ready"}</span>
          <span>
            {text.length.toLocaleString("en-US")} / {MAX_CHARS.toLocaleString("en-US")}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.title} className="text-caption text-ink-muted">
              Title (optional)
            </label>
            <input
              id={ids.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={loading}
              className="h-10 rounded-[var(--radius-control)] bg-surface px-3 text-body text-ink shadow-[0_0_0_1px_var(--hairline-strong)] sm:text-ui"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.url} className="text-caption text-ink-muted">
              Source URL (optional)
            </label>
            <input
              id={ids.url}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={500}
              disabled={loading}
              placeholder="https://"
              className="h-10 rounded-[var(--radius-control)] bg-surface px-3 text-body text-ink shadow-[0_0_0_1px_var(--hairline-strong)] sm:text-ui"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={tooShort || loading}
            className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-ink px-5 text-ui font-bold text-paper transition-[opacity,scale] duration-150 active:scale-[0.96] disabled:opacity-40"
          >
            {loading ? "Reading…" : "Read this law"} <ArrowRightIcon size={16} aria-hidden />
          </button>
          <p className="max-w-[52ch] text-caption text-ink-muted">Takes 20 to 60 seconds. The text you paste is sent to an AI model (Claude) to extract the rules.</p>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {state.kind === "loading" && (
          <motion.div key="progress" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Reading started={state.started} />
          </motion.div>
        )}
      </AnimatePresence>

      {state.kind === "error" && (
        <p role="alert" className="flex max-w-[64ch] gap-2 rounded-[var(--radius-chip)] bg-surface px-3 py-2 text-ui text-ink shadow-[0_0_0_1px_var(--hairline)]">
          <WarningIcon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {state.message}
        </p>
      )}

      {state.kind === "done" && <Results result={state.result} />}
    </div>
  );
}

function Results({ result }: { result: IngestResult }) {
  const verified = result.rules.filter((r) => r.quote_verified).length;
  return (
    <motion.div className="flex flex-col gap-10" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.5, bounce: 0 }}>
      <section className="flex flex-col gap-2 border-t border-hairline pt-8">
        <h2 className="font-wide text-headline text-ink">
          <span className="tnum">{result.affected_count}</span> of <span className="tnum">{result.total_addresses}</span> sample buildings affected
        </h2>
        <p className="tnum text-ui text-ink-muted">
          Compared on {formatDate(result.as_of)} and {formatDate(result.after_date)}, the day after every new rule is in effect. {result.rules.length} rule
          {result.rules.length === 1 ? "" : "s"} extracted · {verified} quote{verified === 1 ? "" : "s"} verified · {result.dropped.length} dropped.
        </p>
      </section>

      <section aria-labelledby="extracted" className="flex flex-col gap-3">
        <h3 id="extracted" className="text-title font-bold text-ink">
          Extracted rules
        </h3>
        {result.rules.length === 0 ? (
          <p className="text-ui text-ink-muted">No rule could be extracted with a verifiable quote.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.rules.map((r) => (
              <IngestedRuleCard key={r.team_rule_id} rule={r} category={categoryLabel(r.category)} />
            ))}
          </ul>
        )}
      </section>

      {result.dropped.length > 0 && (
        <section aria-labelledby="dropped" className="flex flex-col gap-3">
          <h3 id="dropped" className="text-title font-bold text-ink">
            Dropped
          </h3>
          <ul className="flex flex-col gap-2">
            {result.dropped.map((d) => (
              <li key={d.title} className="flex gap-2 text-ui">
                <WarningIcon size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="font-bold text-ink">{d.title}.</span> <span className="text-ink-muted">{d.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="affected" className="flex flex-col gap-3">
        <h3 id="affected" className="flex items-center gap-2 text-title font-bold text-ink">
          <SealCheckIcon size={18} className="text-contour" aria-hidden /> Affected buildings
        </h3>
        <AffectedList affected={result.affected} afterDate={result.after_date} />
      </section>

      <p className="max-w-[64ch] text-caption text-ink-muted">
        <strong className="font-bold text-ink">Not legal advice.</strong> These results come from an automated reading of the text you pasted. Rules whose quote
        could not be found word for word were dropped. Check the source before relying on any of it.
      </p>
    </motion.div>
  );
}
