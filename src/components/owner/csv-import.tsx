"use client";

import { useState } from "react";
import { importMenuAction } from "@/app/actions/owner";
import { MENU_CSV_HEADER } from "@/lib/menu-csv";
import { Button, buttonClass } from "../ui/button";
import { useAction } from "../use-action";

type Result = { created: number; updated: number; errors: { line: number; message: string }[] };

/** Upload a spreadsheet export. Every bad line is listed so the owner can fix them all in one go. */
export function CsvImport({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const { run, pending } = useAction();

  async function upload() {
    if (!file) return;
    const text = await file.text();
    run(() => importMenuAction(text), {
      onOk: (r) => {
        setResult(r);
        if (r.errors.length === 0) onDone();
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <p className="text-sm text-ink-muted">
        One item per row with these columns: <code className="num break-words rounded-[4px] bg-sunken px-1 text-xs text-ink">{MENU_CSV_HEADER.join(", ")}</code>. Items with the same name are updated, new names are added.
      </p>
      <a href="/api/menu/sample" className={buttonClass("outline", "sm", "self-start")} download>
        Download sample CSV
      </a>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="w-full min-w-0 text-sm file:mr-3 file:h-9 file:rounded-slip file:border file:border-line file:bg-surface file:px-3 file:font-semibold file:text-ink"
        />
      </label>
      <Button variant="ink" size="lg" pending={pending} disabled={!file} onClick={upload}>
        Import
      </Button>
      {result && (
        <div aria-live="polite">
          {result.errors.length === 0 ? (
            <p className="rounded-slip bg-veg/10 px-3 py-2 text-sm font-semibold text-veg">
              Imported: {result.created} new, {result.updated} updated.
            </p>
          ) : (
            <div className="rounded-slip border border-danger/40 bg-danger-soft p-3">
              <p className="text-sm font-semibold text-danger">Nothing was imported. Fix these {result.errors.length} lines and try again:</p>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <span className="num font-semibold">Line {e.line}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
