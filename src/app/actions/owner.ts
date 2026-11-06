"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "@/server/auth";
import { addStaff, removeStaff, updateCanteen } from "@/server/canteen";
import { issueCreditNote } from "@/server/credit-notes";
import { runAction, type ActionResult } from "@/server/errors";
import { archiveItem, createItem, importMenuCsv, updateItem } from "@/server/menu";

const id = z.string().min(1).max(40);

function fileFrom(form: FormData, key: string): File | null {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Item fields arrive as JSON next to an optional photo file. */
export async function saveItemAction(form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor("menu:edit");
    const data = JSON.parse(String(form.get("item") ?? "{}")) as unknown;
    const itemId = form.get("id");
    if (typeof itemId === "string" && itemId) await updateItem(actor, id.parse(itemId), data, fileFrom(form, "photo"));
    else await createItem(actor, data, fileFrom(form, "photo"));
    revalidatePath("/owner/menu");
    revalidatePath("/menu");
    return undefined;
  });
}

export async function archiveItemAction(itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    await archiveItem(await requireActor("menu:edit"), id.parse(itemId));
    revalidatePath("/owner/menu");
    return undefined;
  });
}

export async function importMenuAction(csv: string): Promise<ActionResult<{ created: number; updated: number; errors: { line: number; message: string }[] }>> {
  return runAction(async () => {
    if (csv.length > 200_000) throw new Error("CSV too large");
    const result = await importMenuCsv(await requireActor("menu:edit"), csv);
    revalidatePath("/owner/menu");
    return result;
  });
}

export async function updateCanteenAction(form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const data = JSON.parse(String(form.get("canteen") ?? "{}")) as unknown;
    await updateCanteen(await requireActor("canteen:edit"), data, fileFrom(form, "logo"));
    revalidatePath("/owner", "layout");
    return undefined;
  });
}

export async function addStaffAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await addStaff(await requireActor("staff:manage"), input);
    revalidatePath("/owner/staff");
    return undefined;
  });
}

export async function removeStaffAction(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    await removeStaff(await requireActor("staff:manage"), id.parse(userId));
    revalidatePath("/owner/staff");
    return undefined;
  });
}

export async function creditNoteAction(input: unknown): Promise<ActionResult<{ id: string; number: string; totalPaise: number }>> {
  return runAction(async () => {
    const note = await issueCreditNote(await requireActor("invoice:credit-note"), input);
    revalidatePath("/owner/invoices");
    return note;
  });
}
