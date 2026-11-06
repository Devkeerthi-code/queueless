"use client";

import { useRef, useState } from "react";
import { cn } from "../ui/cn";
import { Spinner } from "../ui/button";

const COMMIT_AT = 0.7;
const KNOB = 56;

/**
 * Drag the knob past 70% to commit. Short of that it springs back, so a stray tap never hands over food.
 * Keyboard users get a plain button beneath it.
 */
export function SlideToConfirm({ label, fallbackLabel, onConfirm, pending, disabled }: { label: string; fallbackLabel: string; onConfirm: () => void; pending: boolean; disabled?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef(0);
  const [max, setMax] = useState(0);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const locked = pending || disabled;
  const shown = pending ? max : x;

  function down(e: React.PointerEvent) {
    if (locked || !trackRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStart.current = e.clientX - x;
    setMax(trackRef.current.clientWidth - KNOB - 8);
    setDragging(true);
  }

  const clamp = (clientX: number) => Math.max(0, Math.min(max, clientX - pointerStart.current));

  function move(e: React.PointerEvent) {
    if (dragging) setX(clamp(e.clientX));
  }

  // Use the release point itself, so a fast flick commits even if its last move never rendered.
  function up(e: React.PointerEvent) {
    if (!dragging) return;
    setDragging(false);
    if (e.type === "pointerup" && max > 0 && clamp(e.clientX) >= max * COMMIT_AT) onConfirm();
    setX(0);
  }

  const progress = max ? shown / max : 0;

  return (
    <div className="flex flex-col gap-2">
      <div ref={trackRef} aria-hidden="true" className={cn("relative h-16 select-none overflow-hidden rounded-slip border border-line bg-sunken p-1 touch-none", locked && "opacity-60")}>
        <div className="absolute inset-y-1 left-1 rounded-[4px] bg-accent" style={{ width: shown + KNOB, transition: dragging ? "none" : "width 180ms var(--ease-spring)" }} />
        <span className="pointer-events-none absolute inset-0 grid place-items-center pl-14 text-[15px] font-semibold" style={{ opacity: 1 - progress }}>
          {label} →
        </span>
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={cn("relative z-10 grid h-14 place-items-center rounded-[4px] bg-ink text-paper", locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
          style={{ width: KNOB, transform: `translateX(${shown}px)`, transition: dragging ? "none" : "transform 180ms var(--ease-spring)" }}
        >
          {pending ? <Spinner /> : <span className="text-xl font-bold">»</span>}
        </div>
      </div>
      <button type="button" onClick={onConfirm} disabled={locked} className="self-center rounded-slip px-3 py-1.5 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50">
        {fallbackLabel}
      </button>
    </div>
  );
}
