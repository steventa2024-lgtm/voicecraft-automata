import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../src/routes/dashboard.tsx", import.meta.url), "utf8");
const landing = readFileSync(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const download = readFileSync(new URL("../src/routes/download.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");

test("the public dashboard route only redirects to getting started", () => {
  assert.match(dashboard, /redirect\(\{ to: "\/get-started" \}\)/);
  assert.equal(dashboard.includes("useBridge"), false);
  assert.equal(dashboard.includes("parseCommand"), false);
  assert.equal(dashboard.includes("Mic"), false);
});

test("marketing pages point to the desktop download instead of a browser builder", () => {
  assert.equal(landing.includes('to="/dashboard"'), false);
  assert.match(landing, /Download for Windows/);
  assert.match(header, /to="\/get-started"/);
  assert.equal(header.includes('to="/dashboard"'), false);
  assert.match(download, /Not available in this build/);
  assert.equal(download.includes("Download Bedrock Gateway"), false);
});
