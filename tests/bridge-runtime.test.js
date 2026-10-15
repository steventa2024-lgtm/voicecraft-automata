import assert from "node:assert/strict";
import test from "node:test";
import { parseCommand } from "../packages/protocol/src/index.js";
import { createBridgeRuntime } from "../bridge/runtime.js";

function runtime(overrides = {}) {
  const placed = [];
  const events = [];
  const bridge = createBridgeRuntime({
    authToken: "local-test-token-0123456789abcdef",
    botReady: true,
    onEvent: (event) => events.push(event),
    getPlayer: () => ({ x: 0, y: 80, z: 0, yaw: 0 }),
    sampleBlock: () => "air",
    authorize: async () => ({ allowed: true }),
    place: async ({ plan }) => {
      placed.push(plan.count);
      return { status: "completed", placed: plan.count, failed: 0, skipped: 0, retried: 0, progress: 100 };
    },
    ...overrides,
  });
  return { bridge, placed, events };
}

test("unauthenticated local commands are rejected and the socket is closed", async () => {
  const { bridge, placed } = runtime();
  const client = { authenticated: false };
  const result = await bridge.handleMessage(client, { type: "command", text: "build a house" });
  assert.equal(result.code, "unauthorized");
  assert.equal(result.close, true);
  assert.equal(placed.length, 0);
  assert.equal(bridge.acceptConnection("8.8.8.8").ok, false);
  assert.equal(bridge.acceptConnection("127.0.0.1").ok, true);
});

test("preview and unapproved builds never call the placer", async () => {
  const { bridge, placed } = runtime();
  const client = { authenticated: false };
  assert.equal((await bridge.handleMessage(client, { type: "auth", token: "nope" })).close, true);
  client.authenticated = false;
  await bridge.handleMessage(client, { type: "auth", token: "local-test-token-0123456789abcdef" });
  await bridge.handleMessage(client, { type: "command", text: "preview a stone house" });
  await bridge.handleMessage(client, { type: "command", instruction: parseCommand("build a stone tower") });
  assert.equal(placed.length, 0);
});

test("approval uses the pending plan and refuses a denied entitlement", async () => {
  const denied = runtime({ authorize: async () => ({ allowed: false, message: "Daily task limit reached." }) });
  const client = { authenticated: true };
  await denied.bridge.handleMessage(client, { type: "command", text: "build a small oak house" });
  const jobId = denied.events.find((event) => event.type === "plan").jobId;
  await denied.bridge.handleMessage(client, { type: "approve", jobId, runnerToken: "token" });
  assert.equal(denied.placed.length, 0);

  const allowed = runtime();
  const allowedClient = { authenticated: true };
  await allowed.bridge.handleMessage(allowedClient, { type: "command", text: "build a small oak house" });
  const approvedJob = allowed.events.find((event) => event.type === "plan").jobId;
  await allowed.bridge.handleMessage(allowedClient, { type: "approve", jobId: approvedJob, runnerToken: "token" });
  assert.equal(allowed.placed.length, 1);
});

test("oversized payloads are rejected before parsing", () => {
  const { bridge } = runtime();
  const result = bridge.assessMessage("x".repeat(300_000));
  assert.equal(result.ok, false);
  assert.equal(result.code, "payload_too_large");
});

test("unknown commands do not build", async () => {
  const { bridge, placed, events } = runtime();
  await bridge.handleMessage({ authenticated: true }, { type: "command", text: "sing a song" });
  assert.equal(placed.length, 0);
  assert.equal(events.some((event) => event.type === "error"), true);
});
