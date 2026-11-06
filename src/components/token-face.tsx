import type { ReactNode } from "react";
import { cn } from "./ui/cn";

/** The perforated paper slip with the big daily token. Used on the token page and the landing example. */
export function TokenFace({ token, caption, children, print = true, className }: { token: string; caption: ReactNode; children?: ReactNode; print?: boolean; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div aria-hidden="true" className="relative z-10 mx-auto h-2 w-[calc(100%-24px)] rounded-full bg-ink/85" />
      <div className={cn("relative -mt-1 px-1", print && "animate-print")}>
        <div className="slip perforated px-5 pb-6 pt-7 shadow-none">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">{caption}</p>
          <p className="num condensed mt-1 text-center text-token font-extrabold tracking-[-0.02em]">{token}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
