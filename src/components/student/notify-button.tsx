"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { savePushSubscriptionAction } from "@/app/actions/orders";
import { Button } from "../ui/button";

type Support = "unknown" | "unconfigured" | "unsupported" | "ios-install" | "denied" | "granted" | "default";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function readSupport(): Support {
  if (!VAPID) return "unconfigured";
  const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!hasPush) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios ? "ios-install" : "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : Notification.permission === "granted" ? "granted" : "default";
}

const noopSubscribe = () => () => undefined;

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribe(): Promise<boolean> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
  const result = await savePushSubscriptionAction(sub.toJSON());
  return result.ok;
}

/** Asks for notification permission only after a tap, and explains plainly when it can't work. */
export function NotifyButton() {
  const support = useSyncExternalStore(noopSubscribe, readSupport, () => "unknown" as Support);
  const [state, setState] = useState<"idle" | "busy" | "on">("idle");

  useEffect(() => {
    if (support === "granted") subscribe().catch(() => undefined);
  }, [support]);

  if (support === "unknown" || support === "unconfigured") return null;
  if (support === "ios-install") {
    return <Note>To get a notification on iPhone, add QueueLess to your Home Screen (Share, then Add to Home Screen) and open it from there.</Note>;
  }
  if (support === "unsupported") return <Note>This browser can&apos;t show notifications. Keep this page open; it updates on its own.</Note>;
  if (support === "denied") return <Note>Notifications are blocked for this site. Allow them in your browser settings, or keep this page open.</Note>;
  if (support === "granted" || state === "on") return <Note tone="ok">We&apos;ll notify you the moment it&apos;s ready.</Note>;

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("idle");
        toast("No problem. This page still updates on its own.");
        return;
      }
      const ok = await subscribe();
      setState(ok ? "on" : "idle");
      if (ok) toast.success("Notifications on for this order");
      else toast.error("Couldn't turn on notifications. Try again.");
    } catch {
      setState("idle");
      toast.error("Couldn't turn on notifications on this device.");
    }
  }

  return (
    <Button variant="outline" size="lg" pending={state === "busy"} onClick={enable} className="w-full">
      <BellIcon />
      Notify me when it&apos;s ready
    </Button>
  );
}

function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "ok" }) {
  return (
    <p className={`flex items-start gap-2 rounded-slip border border-line px-3 py-2.5 text-sm ${tone === "ok" ? "text-veg" : "text-ink-muted"}`}>
      <BellIcon />
      <span>{children}</span>
    </p>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mt-px size-4 shrink-0" aria-hidden="true">
      <path d="M8 1.8a4 4 0 0 0-4 4v2.6L2.6 11h10.8L12 8.4V5.8a4 4 0 0 0-4-4zM6.3 13a1.8 1.8 0 0 0 3.4 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
