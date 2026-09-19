import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("Preview refuses repository writes even when the demo write flag is true", () => {
  const output = execFileSync(process.execPath, [
    "--conditions=react-server",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--input-type=module",
    "-e",
    `import { assertWriteAllowed, isDemoWriteEnabled } from './src/lib/env.ts';
     if (isDemoWriteEnabled) throw new Error('Preview enabled writes');
     try { assertWriteAllowed(); throw new Error('Mutation allowed'); }
     catch (error) { if (error.code !== 'WRITE_DISABLED') throw error; }
     console.log('refused');`,
  ], {
    cwd: process.cwd(),
    env: { ...process.env, VERCEL_ENV: "preview", DEMO_WRITE_ENABLED: "true" },
    encoding: "utf8",
  });
  assert.equal(output.trim(), "refused");
});
