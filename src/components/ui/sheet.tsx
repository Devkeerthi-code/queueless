"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

type Props = { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; variant?: "sheet" | "drawer"; className?: string };

/**
 * Native <dialog> as a bottom sheet (or side drawer): focus trapping, Esc and the backdrop come free.
 * Tapping the backdrop closes it.
 */
export function Sheet({ open, onClose, title, description, children, variant = "sheet", className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn(variant, className)}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          {variant === "sheet" && <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line sm:hidden" />}
          <div className="min-w-0 flex-1">
            <h2 id="sheet-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="text-sm text-ink-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="press -mr-2 grid size-10 place-items-center rounded-slip text-ink-muted hover:bg-sunken hover:text-ink" aria-label="Close">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto">{open && children}</div>
      </div>
    </dialog>
  );
}
