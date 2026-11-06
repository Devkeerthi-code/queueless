import type { ReactNode } from "react";
import { cn } from "./ui/cn";

/**
 * The printed token: a turmeric stub with the big number, a perforation, then the cream counterfoil.
 * A carbon copy sits behind it and the whole slip feeds out of a printer slot when it mounts.
 */
export function TokenFace({ token, caption, children, print = true, className }: { token: string; caption: ReactNode; children?: ReactNode; print?: boolean; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden="true" className="relative z-10 mx-auto h-2.5 w-[calc(100%-8px)] rounded-full bg-[#2a241e] shadow-[inset_0_2px_3px_rgb(0_0_0/0.6)]" />
      <div className="-mt-1.5 overflow-hidden px-2 pb-4">
        <div className={cn("lift", print && "animate-print")}>
          <div className="carbon">
            <article className="paper edge-torn-b">
              <div className="bg-accent px-5 pb-5 pt-6 text-center text-on-accent">
                <p className="caps">{caption}</p>
                <p className="condensed mt-1 text-token font-extrabold tracking-[-0.02em]">{token}</p>
              </div>
              <div className="perf-h" aria-hidden="true" />
              <div className="px-5 pt-4">{children}</div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
