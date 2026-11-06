"use client";

import { Toaster as Sonner } from "sonner";

/** Toasts look like torn receipt strips: paper, hairline, a coloured edge for the outcome. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: 96 }}
      mobileOffset={{ bottom: 88 }}
      duration={3500}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(92vw,380px)] items-start gap-3 rounded-slip border border-line bg-surface px-4 py-3 text-[15px] text-ink shadow-[0_2px_0_var(--line),0_8px_24px_rgb(0_0_0/0.12)]",
          title: "font-semibold",
          description: "text-sm text-ink-muted",
          success: "border-l-4 border-l-veg",
          error: "border-l-4 border-l-danger",
          warning: "border-l-4 border-l-warn",
          actionButton: "ml-auto rounded-slip bg-ink px-3 py-1 text-sm font-semibold text-on-ink",
        },
      }}
    />
  );
}
