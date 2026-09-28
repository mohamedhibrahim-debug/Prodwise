"use server";
import { revalidatePath } from "next/cache";
import { markRead } from "@/lib/notifications/service";

export interface MarkState { error: string | null; message: string | null }
export async function markAllReadAction(_previous: MarkState, form: FormData): Promise<MarkState> {
  const fingerprints = String(form.get("fingerprints") ?? "").split(",").filter(Boolean).slice(0, 500);
  try {
    const n = await markRead(fingerprints);
    revalidatePath("/notifications");
    return { error: null, message: n ? `Marked ${n} as read.` : "Nothing new to mark." };
  } catch { return { error: "Read marks could not be saved. Try again; nothing else changed.", message: null }; }
}
