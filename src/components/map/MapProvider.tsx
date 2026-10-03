"use client";

import { useEffect, useSyncExternalStore } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

let failed = false;
const listeners = new Set<() => void>();

export function reportMapFailure() {
  markFailed();
}

function markFailed() {
  failed = true;
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  (window as unknown as { gm_authFailure: () => void }).gm_authFailure = markFailed;
}

export function useMapFailed(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => failed,
    () => false,
  );
}

export function MapProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  useEffect(() => {
    if (!key) {
      markFailed();
      return;
    }
    const ctrl = new AbortController();
    fetch(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => {
        if (r.status === 400 || r.status === 403) markFailed();
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [key]);

  return (
    <APIProvider apiKey={key} libraries={["geocoding"]} version="beta" onError={markFailed}>
      {children}
    </APIProvider>
  );
}
