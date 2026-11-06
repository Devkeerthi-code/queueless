export type Role = "STUDENT" | "COUNTER" | "KITCHEN" | "OWNER";

export type Action =
  | "order:place"
  | "order:cancel-own"
  | "order:cancel-any"
  | "kitchen:view"
  | "kitchen:advance"
  | "counter:view"
  | "counter:collect"
  | "counter:walk-in"
  | "invoice:view"
  | "invoice:credit-note"
  | "menu:edit"
  | "menu:toggle-availability"
  | "canteen:edit"
  | "staff:manage"
  | "reports:view";

const MATRIX: Record<Role, readonly Action[]> = {
  STUDENT: ["order:place", "order:cancel-own"],
  KITCHEN: ["kitchen:view", "kitchen:advance", "menu:toggle-availability"],
  COUNTER: ["counter:view", "counter:collect", "counter:walk-in", "invoice:view", "order:cancel-any", "kitchen:view"],
  OWNER: [
    "order:cancel-any", "kitchen:view", "kitchen:advance", "counter:view", "counter:collect", "counter:walk-in",
    "invoice:view", "invoice:credit-note", "menu:edit", "menu:toggle-availability", "canteen:edit", "staff:manage",
    "reports:view",
  ],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Your role can't do this (${action}).`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(action);
}

export const HOME_FOR_ROLE: Record<Role, string> = {
  STUDENT: "/menu",
  KITCHEN: "/kitchen",
  COUNTER: "/counter",
  OWNER: "/owner",
};
