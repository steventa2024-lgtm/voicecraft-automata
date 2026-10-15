import assert from "node:assert/strict";
import test from "node:test";
import { externalUrl, mergeSettings, scrubChildEnv, senderAllowed, validateInvoke } from "../desktop/electron/policy.js";

test("IPC rejects unknown channels and forged approval shortcuts", () => {
  assert.equal(validateInvoke("shell.exec", { command: "calc" }).ok, false);
  assert.equal(validateInvoke("bridge.command", { text: "" }).ok, false);
  assert.equal(validateInvoke("bridge.command", { text: "x".repeat(501) }).ok, false);
  const command = validateInvoke("bridge.command", { text: "preview a stone house" });
  assert.equal(command.ok, true);
  assert.equal(command.payload.text, "preview a stone house");
});

test("settings reject service-role keys and remote Ollama hosts", () => {
  assert.equal(validateInvoke("settings.set", { supabasePublishableKey: "sb_secret_should_not_be_here" }).ok, false);
  assert.equal(validateInvoke("settings.set", { ollamaUrl: "http://203.0.113.8:11434" }).ok, false);
  assert.equal(validateInvoke("settings.set", { ollamaUrl: "http://127.0.0.1:11434" }).ok, true);
  assert.equal(validateInvoke("settings.set", { surprise: true }).ok, false);
});

test("external links stay on the configured website origin", () => {
  assert.equal(externalUrl("https://zeropulse.example", "/download"), "https://zeropulse.example/download");
  assert.equal(externalUrl("https://zeropulse.example", "https://evil.example"), null);
  assert.equal(externalUrl("https://zeropulse.example", "//evil.example"), null);
  assert.equal(senderAllowed("file:///app/index.html", 5173), true);
  assert.equal(senderAllowed("http://127.0.0.1:5173/", 5173), true);
  assert.equal(senderAllowed("http://127.0.0.1:9999/", 5173), false);
  assert.equal(senderAllowed("https://id-preview--example.lovable.app", 5173), false);
});

test("saving settings keeps the stored publishable key when the form sends the mask", () => {
  const merged = mergeSettings(
    { supabasePublishableKey: "sb_publishable_example", appOrigin: "http://127.0.0.1:8080" },
    { supabasePublishableKey: "configured", ollamaModel: "llama3.2" },
  );
  assert.equal(merged.supabasePublishableKey, "sb_publishable_example");
  assert.equal(merged.ollamaModel, "llama3.2");
  assert.equal(mergeSettings({ supabasePublishableKey: "sb_publishable_example" }, { supabasePublishableKey: "" }).supabasePublishableKey, "");
});

test("bridge child environment drops privileged credentials", () => {
  const env = scrubChildEnv({
    PATH: "/usr/bin",
    SUPABASE_SERVICE_ROLE_KEY: "not-a-real-secret",
    STRIPE_SECRET_KEY: "not-a-real-secret",
    BRIDGE_AUTH_TOKEN: "old-token",
    MC_HOST: "localhost",
  });
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.MC_HOST, "localhost");
  assert.equal(Object.hasOwn(env, "SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(Object.hasOwn(env, "STRIPE_SECRET_KEY"), false);
  assert.equal(Object.hasOwn(env, "BRIDGE_AUTH_TOKEN"), false);
});

test("desktop sources do not point the product at a Lovable preview", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === "node_modules" || entry === "dist") continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|cjs|html|tsx|ts|css)$/.test(entry)) files.push(full);
    }
  };
  walk(new URL("../desktop", import.meta.url).pathname);
  const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.equal(combined.includes("lovable.app"), false);
  assert.equal(combined.includes("id-preview--"), false);
});
