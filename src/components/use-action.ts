"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/errors";

type RunOptions<T> = {
  success?: string | ((data: T) => string);
  onOk?: (data: T) => void;
  onError?: (result: { error: string; code?: string; fields?: Record<string, string> }) => void;
};

/**
 * Runs a server action inside a transition so the button stays disabled until it settles.
 * Errors become toasts; field errors are kept for inline display.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<Record<string, string>>({});

  function run<T>(action: () => Promise<ActionResult<T>>, opts: RunOptions<T> = {}) {
    startTransition(async () => {
      let result: ActionResult<T>;
      try {
        result = await action();
      } catch {
        toast.error("Couldn't reach the server", { description: "Check your connection and try again." });
        return;
      }
      if (result.ok) {
        setFields({});
        if (opts.success) toast.success(typeof opts.success === "string" ? opts.success : opts.success(result.data));
        opts.onOk?.(result.data);
      } else {
        setFields(result.fields ?? {});
        toast.error(result.error);
        opts.onError?.(result);
      }
    });
  }

  return { run, pending, fields, setFields };
}
