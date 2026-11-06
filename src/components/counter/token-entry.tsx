"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { inputClass } from "../ui/field";
import { cn } from "../ui/cn";

const LETTERS = ["A", "B", "C", "D"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Type a token like A23. A big keypad on touch screens; a normal input with Enter on laptops. */
export function TokenEntry({ onSubmit, pending }: { onSubmit: (token: string) => void; pending: boolean }) {
  const [value, setValue] = useState("");
  const clean = value.replace(/\s/g, "").toUpperCase();
  const valid = /^[A-Z]\d{1,2}$/.test(clean);

  const press = (k: string) => setValue((v) => (/^[A-Z]$/.test(k) ? k : (v + k).slice(0, 3)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (valid) onSubmit(clean);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="token" className="text-sm font-medium">
        Or type the token
      </label>
      <div className="flex gap-2">
        <input
          id="token"
          value={clean}
          onChange={(e) => setValue(e.target.value.slice(0, 3))}
          placeholder="A23"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={cn(inputClass, "num condensed h-14 flex-1 text-center text-3xl font-extrabold uppercase tracking-wider")}
        />
        <Button type="submit" variant="ink" size="lg" disabled={!valid} pending={pending}>
          Find
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 md:hidden" aria-label="Token keypad">
        {LETTERS.map((l) => (
          <Key key={l} onClick={() => press(l)} label={l} accent />
        ))}
        {KEYS.map((k) => (
          <Key key={k} onClick={() => press(k)} label={k} />
        ))}
        <Key onClick={() => setValue((v) => v.slice(0, -1))} label="⌫" aria="Delete" />
        <Key onClick={() => press("0")} label="0" />
        <Key onClick={() => setValue("")} label="Clear" aria="Clear token" />
      </div>
    </form>
  );
}

function Key({ label, onClick, accent, aria }: { label: string; onClick: () => void; accent?: boolean; aria?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className={cn("press h-12 rounded-slip border text-lg font-bold num", accent ? "border-accent/60 bg-accent/15" : "border-line bg-surface")}
    >
      {label}
    </button>
  );
}
