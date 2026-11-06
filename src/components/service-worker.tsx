"use client";

import { useEffect } from "react";

/** Registers the push service worker once; does nothing where service workers aren't supported. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
