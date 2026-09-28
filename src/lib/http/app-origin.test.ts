import { test } from "node:test";
import assert from "node:assert/strict";
import { appOrigin } from "./app-origin.ts";

test("configured public URL wins and is reduced to an origin", () => {
  assert.equal(appOrigin({ PRODWISE_PUBLIC_URL: "https://prodwise.example/app", NODE_ENV: "production" }), "https://prodwise.example");
});
test("falls back to the Vercel production domain, never a request header", () => {
  assert.equal(appOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "prodwise.vercel.app", NODE_ENV: "production" }), "https://prodwise.vercel.app");
});
test("production with nothing configured refuses rather than guessing", () => {
  assert.equal(appOrigin({ NODE_ENV: "production" }), null);
});
test("development uses localhost only", () => {
  assert.equal(appOrigin({ NODE_ENV: "development", PORT: "3100" }), "http://localhost:3100");
  assert.equal(appOrigin({ PRODWISE_PUBLIC_URL: "http://attacker.example", NODE_ENV: "development", PORT: "3100" }), "http://localhost:3100");
  assert.equal(appOrigin({ NODE_ENV: "development" }, "127.0.0.1:3100"), "http://127.0.0.1:3100");
  assert.equal(appOrigin({ NODE_ENV: "development" }, "attacker.example"), "http://localhost:3000");
  assert.equal(appOrigin({ NODE_ENV: "production" }, "localhost:3000"), null);
});
