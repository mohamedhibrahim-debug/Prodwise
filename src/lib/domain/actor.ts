import type { Actor } from "./types";

export function currentActor(): Actor {
  return { id: null, label: "Demo mode (no signed-in user)" };
}
