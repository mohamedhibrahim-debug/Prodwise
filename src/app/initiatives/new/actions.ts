"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import { WriteDisabledError } from "@/lib/env";

export interface CreateInitiativeState {
  error: string | null;
}

export async function createInitiativeAction(
  _prev: CreateInitiativeState,
  formData: FormData,
): Promise<CreateInitiativeState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const knownReferences = String(formData.get("knownReferences") ?? "").trim();

  if (name.length === 0) {
    return { error: "Initiative name is required." };
  }
  if (name.length > 160) {
    return { error: "Initiative name must be 160 characters or fewer." };
  }

  let slug: string;
  try {
    const created = await getRepository().createInitiative({
      name,
      description: description || null,
      knownReferences: knownReferences || null,
    });
    slug = created.slug;
  } catch (error) {
    // The write guard is enforced in the repository layer. Surface its refusal
    // as a handled message rather than an unhandled server error.
    if (error instanceof WriteDisabledError) {
      return { error: error.message };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create the initiative.",
    };
  }

  revalidatePath("/initiatives");
  redirect(`/initiatives/${slug}`);
}
