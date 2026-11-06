"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "../ui/cn";

const DRAG_START = 6;
const TEAR_AT = 56;
const RESISTANCE = 0.55;

type Props = {
  onTear: () => void;
  children: ReactNode;
  label: string;
  disabled?: boolean;
  className?: string;
  /** Plays the stub "tug" animation on every tear. Off when the button unmounts right away. */
  tug?: boolean;
};

/**
 * A perforated stub you can tear off. A tap or Enter tears it instantly; dragging it sideways past the
 * perforation is an optional extra with a little resistance, and a short drag springs back without firing.
 */
export function TearButton({ onTear, children, label, disabled, className, tug = true }: Props) {
  const start = useRef<number | null>(null);
  const dragging = useRef(false);
  const swallowClick = useRef(false);
  const [dx, setDx] = useState(0);
  const [tugs, setTugs] = useState(0);

  function fire() {
    if (tug) setTugs((n) => n + 1);
    if ("vibrate" in navigator) navigator.vibrate(12);
    onTear();
  }

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || e.button !== 0) return;
    start.current = e.clientX;
    dragging.current = false;
    swallowClick.current = false;
  }

  function move(e: React.PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    const d = e.clientX - start.current;
    if (!dragging.current && Math.abs(d) > DRAG_START) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (dragging.current) setDx(Math.max(0, d) * RESISTANCE);
  }

  function up(e: React.PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    const d = e.clientX - start.current;
    start.current = null;
    if (!dragging.current) return;
    dragging.current = false;
    swallowClick.current = true;
    setDx(0);
    if (e.type === "pointerup" && d >= TEAR_AT) fire();
  }

  function click() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    fire();
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={click}
      className={cn("relative select-none touch-pan-y disabled:cursor-not-allowed", className)}
      style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 14}deg)` : undefined, transition: dx ? "none" : "transform 180ms var(--ease-spring)" }}
    >
      <span key={tugs} className={cn("flex size-full items-center justify-center", tugs > 0 && "animate-tear")}>
        {children}
      </span>
    </button>
  );
}
