import type { Actor } from "./types";
import { requireWorkspaceAccess } from "../auth/access";

export async function currentActor(): Promise<Actor> {
  return (await requireWorkspaceAccess()).actor;
}
