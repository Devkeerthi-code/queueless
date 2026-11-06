"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PollStatus = "live" | "reconnecting" | "offline";

type Options = { intervalMs?: number };

const MAX_BACKOFF_MS = 30_000;

/**
 * Polls a JSON endpoint. Pauses while the tab is hidden, refetches as soon as it's visible again,
 * and backs off (doubling up to 30s) while requests fail.
 */
export function usePoll<T>(url: string | null, initial: T, { intervalMs = 4000 }: Options = {}) {
  const [data, setData] = useState<T>(initial);
  const [status, setStatus] = useState<PollStatus>("live");
  const [tick, setTick] = useState(0);
  const failures = useRef(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) return;
    const endpoint = url;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let stopped = false;

    const schedule = () => {
      if (stopped || document.hidden) return;
      const delay = failures.current === 0 ? intervalMs : Math.min(intervalMs * 2 ** failures.current, MAX_BACKOFF_MS);
      timer = setTimeout(load, delay);
    };

    async function load() {
      clearTimeout(timer);
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as T;
        failures.current = 0;
        setStatus("live");
        setData(next);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        failures.current += 1;
        setStatus(navigator.onLine ? "reconnecting" : "offline");
      }
      schedule();
    }

    const onVisible = () => {
      if (!document.hidden) load();
      else clearTimeout(timer);
    };
    const onOnline = () => load();
    const onOffline = () => setStatus("offline");

    if (tick > 0) load();
    else schedule();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [url, intervalMs, tick]);

  return { data, setData, status, refresh };
}
