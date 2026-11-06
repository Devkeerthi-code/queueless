import { ZodError } from "zod";

/** Errors whose message is safe and useful to show the person who caused them. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly code: string = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "UserError";
  }
}

export class SoldOutError extends UserError {
  constructor(
    readonly itemName: string,
    readonly remaining: number,
  ) {
    super(remaining > 0 ? `Only ${remaining} ${itemName} left. Reduce the quantity and try again.` : `${itemName} just sold out.`, "SOLD_OUT");
  }
}

export class SlotFullError extends UserError {
  constructor() {
    super("That pickup slot just filled up. Pick another slot.", "SLOT_FULL");
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fields?: Record<string, string> };

/** Wraps a server action body so expected errors become messages and unexpected ones are logged, not leaked. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) fields[issue.path.join(".")] ??= issue.message;
      return { ok: false, error: err.issues[0]?.message ?? "Check the highlighted fields.", code: "INVALID", fields };
    }
    if (err instanceof Error && err.name === "ForbiddenError") return { ok: false, error: err.message, code: "FORBIDDEN" };
    if (err instanceof Error && "digest" in err) throw err; // let Next handle redirect()/notFound()
    console.error(err);
    return { ok: false, error: "Something went wrong on our side. Please try again.", code: "INTERNAL" };
  }
}
