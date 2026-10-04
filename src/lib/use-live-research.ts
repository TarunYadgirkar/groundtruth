"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchEvent, ResearchRequest, ResearchResult, ResearchStage } from "./live-research";

const APPLY_MS = 450;

export type ResearchState =
  | { phase: "idle" }
  | { phase: "running"; stage: ResearchStage | "applying"; pages: number; startedAt: number }
  | { phase: "done"; result: ResearchResult; seconds: number }
  | { phase: "error"; message: string };

async function readEvents(res: Response, onEvent: (e: ResearchEvent) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ResearchEvent);
  }
}

export function useLiveResearch(request: ResearchRequest): { state: ResearchState; start: () => void } {
  const [state, setState] = useState<ResearchState>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      abort.current?.abort();
      window.clearTimeout(timer.current);
    },
    [],
  );

  const start = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const startedAt = Date.now();
    setState({ phase: "running", stage: "searching", pages: 0, startedAt });
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ phase: "error", message: body.error ?? "Live research isn't available right now." });
        return;
      }
      let finished = false;
      await readEvents(res, (e) => {
        if (e.type === "stage") setState({ phase: "running", stage: e.stage, pages: e.pages, startedAt });
        if (e.type === "error") setState({ phase: "error", message: e.message });
        if (e.type === "result") {
          const seconds = Math.round((Date.now() - startedAt) / 1000);
          setState({ phase: "running", stage: "applying", pages: e.result.pages_read, startedAt });
          timer.current = window.setTimeout(() => setState({ phase: "done", result: e.result, seconds }), APPLY_MS);
        }
        finished ||= e.type !== "stage";
      });
      if (!finished) setState({ phase: "error", message: "The connection closed before research finished." });
    } catch {
      if (!controller.signal.aborted) setState({ phase: "error", message: "The connection dropped before research finished." });
    }
  }, [request]);

  return { state, start };
}
