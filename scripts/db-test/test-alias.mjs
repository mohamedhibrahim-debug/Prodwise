import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Node's test runner does not read tsconfig paths; production resolves these
// through Next. Keep this hook confined to the local adapter test command.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = specifier.endsWith(".ts") ? specifier.slice(2) : `${specifier.slice(2)}.ts`;
      return nextResolve(new URL(`../../src/${path}`, import.meta.url).href, context);
    }
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL) {
      const resolved = new URL(specifier, context.parentURL);
      if (existsSync(`${fileURLToPath(resolved)}.ts`)) {
        return nextResolve(`${resolved.href}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
