"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpIcon, CircleNotchIcon, XIcon } from "@phosphor-icons/react";
import type { AskAnswer, UiAction } from "@/lib/ask-schema";
import type { Address } from "@/lib/types";

const EXAMPLES = ["Can my rent go up 10% this year?", "What changes in July 2027?", "Why is the deposit rule unknown?"];

interface AskBarProps {
  address: Address;
  asOf: string;
  onActions: (actions: UiAction[]) => void;
}

type State = { kind: "idle" } | { kind: "loading"; q: string } | { kind: "answer"; q: string; data: AskAnswer } | { kind: "error"; q: string; message: string };

export default function AskBar({ address, asOf, onActions }: AskBarProps) {
  const id = useId();
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const isLive = address.address_id.startsWith("live-");

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || state.kind === "loading") return;
    setState({ kind: "loading", q: text });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isLive ? { question: text, asOf, live_address: address } : { question: text, asOf, address_id: address.address_id }),
      });
      const json = (await res.json()) as AskAnswer | { error: string };
      if (!res.ok || "error" in json) {
        setState({ kind: "error", q: text, message: "error" in json ? json.error : "Something went wrong." });
        return;
      }
      setState({ kind: "answer", q: text, data: json });
      setQ("");
      onActions(json.ui_actions);
    } catch {
      setState({ kind: "error", q: text, message: "Couldn't reach the assistant. Check your connection." });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {state.kind !== "idle" && (
          <motion.div
            key={state.q + state.kind}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
            className="relative rounded-[var(--radius-control)] bg-surface-sunk px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--hairline)]"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="eyebrow text-ink-muted">{state.q}</p>
              {state.kind !== "loading" && (
                <button type="button" aria-label="Dismiss answer" onClick={() => setState({ kind: "idle" })} className="-mr-1 -mt-0.5 grid size-6 shrink-0 place-items-center rounded-[4px] text-ink-muted hover:bg-paper hover:text-ink">
                  <XIcon size={12} aria-hidden />
                </button>
              )}
            </div>
            {state.kind === "loading" && (
              <p className="mt-1 flex items-center gap-2 text-ui text-ink-muted">
                <CircleNotchIcon size={14} className="animate-spin" aria-hidden /> Reading the rules for this address…
              </p>
            )}
            {state.kind === "error" && <p className="mt-1 text-ui text-ink">{state.message}</p>}
            {state.kind === "answer" && (
              <>
                <p className="mt-1 text-ui text-ink">{state.data.answer}</p>
                {state.data.cited_rule_ids.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-1 font-mono text-[0.6875rem] text-ink-muted">
                    Cites
                    {state.data.cited_rule_ids.map((r) => (
                      <span key={r} className="rounded-[3px] bg-paper px-1 text-ink">
                        {r}
                      </span>
                    ))}
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {state.kind === "idle" && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none]">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => ask(ex)}
              className="h-7 shrink-0 rounded-full bg-surface-sunk px-2.5 text-caption text-ink shadow-[inset_0_0_0_1px_var(--hairline)] transition-[background-color,scale] duration-150 hover:bg-paper active:scale-[0.96]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-surface pl-3 pr-1.5 shadow-[0_0_0_1px_var(--hairline-strong)] transition-shadow duration-150 focus-within:shadow-[0_0_0_1.5px_var(--ink),0_0_0_5px_rgba(200,69,44,0.12)]"
      >
        <label htmlFor={id} className="sr-only">
          Ask about this address
        </label>
        <input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={500}
          placeholder="Ask about this address"
          className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none sm:text-ui"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={q.trim().length < 3 || state.kind === "loading"}
          className="grid size-8 place-items-center rounded-[4px] bg-ink text-paper transition-[opacity,scale] duration-150 active:scale-[0.96] disabled:opacity-30"
        >
          <ArrowUpIcon size={16} weight="bold" aria-hidden />
        </button>
      </form>
    </div>
  );
}
