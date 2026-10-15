import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  applyReservation,
  assertBlockId,
  buildPlan,
  createPkce,
  createReservationGate,
  decideDispatch,
  describeInstruction,
  evaluateChatCommand,
  evaluateEntitlement,
  executeDispatch,
  executeOperations,
  exportBlueprint,
  finalStatus,
  identifyExternalSchematic,
  importBlueprint,
  isAllowedLoopbackRedirect,
  issueRunnerToken,
  parseCommand,
  placementOrigin,
  planRedo,
  planToInstruction,
  planUndo,
  releaseReservation,
  surveyTerrain,
  toFillRuns,
  transition,
  isLocalOllamaModel,
  isLocalOllamaUrl,
  validatePlannerResponse,
  verifyCommandEnvelope,
  verifyPkce,
  verifyRunnerToken,
  worldBoundsError,
  worldPosition,
  envelopeSigningBytes,
} from "../packages/protocol/src/index.js";

test("parses structures, materials, and size without confusing sandstone for stone", () => {
  const mansion = parseCommand("build me a large stone mansion");
  assert.equal(mansion.action, "build");
  assert.equal(mansion.structure, "mansion");
  assert.equal(mansion.material, "stone_bricks");
  assert.equal(mansion.size, "large");
  assert.equal(mansion.valid, true);
  assert.ok(mansion.dimensions.width > parseCommand("build a stone mansion").dimensions.width);

  const sand = parseCommand("build a sandstone castle");
  assert.equal(sand.material, "sandstone");
  assert.equal(sand.structure, "castle");

  const bricks = parseCommand("build a two floor brick mansion");
  assert.equal(bricks.material, "bricks");
  assert.equal(bricks.floors, 2);
});

test("parses relative directions and explicit distance", () => {
  assert.equal(parseCommand("build a mansion in front of me").direction, "front");
  assert.equal(parseCommand("build a tower behind me").direction, "back");
  assert.equal(parseCommand("build a castle to my left").direction, "left");
  assert.equal(parseCommand("build a bridge to my right").direction, "right");
  const ahead = parseCommand("build a house 20 blocks ahead");
  assert.equal(ahead.offset.z, 20);
  assert.equal(ahead.direction, "front");
  assert.equal(ahead.structure, "house");
});

test("parses dimensions, floors, and explicit coordinates", () => {
  const by = parseCommand("build a house 15 by 20");
  assert.deepEqual(by.dimensions, { width: 15, depth: 20, height: by.dimensions.height });
  const grid = parseCommand("build a house 15x20");
  assert.equal(grid.dimensions.width, 15);
  assert.equal(grid.dimensions.depth, 20);
  const box = parseCommand("build a house 15x20x10");
  assert.deepEqual(box.dimensions, { width: 15, depth: 20, height: 10 });
  assert.equal(parseCommand("build a wall 20 blocks wide").dimensions.width, 20);
  assert.equal(parseCommand("build a tower 10 blocks tall").dimensions.height, 10);
  assert.equal(parseCommand("build a house with 5 floors").floors, 5);

  const at = parseCommand("build a house at 100 64 -20");
  assert.deepEqual(at.position, { x: 100, y: 64, z: -20 });
  const labeled = parseCommand("build a tower at x 12 y 70 z -4");
  assert.deepEqual(labeled.position, { x: 12, y: 70, z: -4 });
});

test("rejects unknown, empty, and oversized instructions", () => {
  const unknown = parseCommand("play a song please");
  assert.equal(unknown.action, "unknown");
  assert.equal(unknown.valid, false);
  assert.equal(parseCommand("   ").valid, false);
  const huge = parseCommand(`build a house ${"9".repeat(600)}`);
  assert.equal(huge.valid, false);
  assert.match(huge.errors[0], /500/);
  const wide = parseCommand("build a house 400 by 20");
  assert.equal(wide.valid, false);
  assert.match(wide.errors.join(" "), /Width/);
});

test("clear does not require a structure and stays unapproved", () => {
  const clear = parseCommand("clear a 15 by 15 area to my left");
  assert.equal(clear.action, "clear");
  assert.equal(clear.structure, "unknown");
  assert.equal(clear.direction, "left");
  assert.equal(clear.dimensions.width, 15);
  assert.equal(clear.dimensions.depth, 15);
  assert.equal(clear.requiresConfirmation, true);
  assert.equal(clear.approved, false);
  assert.equal(clear.valid, true);
  assert.match(describeInstruction(clear), /Clear 15×15/);
});

test("preview, undo, and unknown never enter the build branch", async () => {
  const calls = [];
  const handlers = {
    preview: () => calls.push("preview"),
    inspect: () => calls.push("inspect"),
    build: () => calls.push("build"),
    clear: () => calls.push("clear"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    stop: () => calls.push("stop"),
    pause: () => calls.push("pause"),
    resume: () => calls.push("resume"),
    awaiting_approval: () => calls.push("awaiting_approval"),
    reject: () => calls.push("reject"),
  };

  await executeDispatch(decideDispatch(parseCommand("preview a large stone mansion"), { authorized: true }), handlers);
  await executeDispatch(decideDispatch(parseCommand("inspect the courtyard"), { authorized: true }), handlers);
  await executeDispatch(decideDispatch(parseCommand("undo the last build"), { authorized: true }), handlers);
  await executeDispatch(decideDispatch(parseCommand("what is the weather"), { authorized: true }), handlers);
  await executeDispatch(
    decideDispatch({ ...parseCommand("undo the last build"), approved: true }, { authorized: true }),
    handlers,
  );
  assert.deepEqual(calls, ["preview", "inspect", "awaiting_approval", "reject", "undo"]);
  assert.equal(calls.includes("build"), false);
});

test("clear, stop, and unauthorized commands take explicit branches", async () => {
  const calls = [];
  const handlers = new Proxy(
    {},
    {
      get: (_target, property) => () => calls.push(String(property)),
    },
  );
  const clear = parseCommand("clear a 9 by 9 area");
  await executeDispatch(decideDispatch(clear, { authorized: true }), handlers);
  await executeDispatch(decideDispatch({ ...clear, approved: true }, { authorized: true }), handlers);
  await executeDispatch(decideDispatch(parseCommand("stop"), { authorized: true }), handlers);
  await executeDispatch(
    decideDispatch({ ...parseCommand("build a house"), approved: true }, { authorized: false }),
    handlers,
  );
  assert.deepEqual(calls, ["awaiting_approval", "clear", "stop", "reject"]);
});

test("places structures on the correct side of every cardinal facing", () => {
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const directions = ["front", "back", "left", "right"];
  for (const yaw of yaws) {
    for (const direction of directions) {
      const instruction = {
        ...parseCommand("build a house"),
        direction,
        dimensions: { width: 5, depth: 7, height: 4 },
        offset: { x: 0, y: 0, z: 20 },
        rotation: 0,
        position: null,
      };
      const origin = placementOrigin({ player: { x: 10, y: 64, z: -30 }, yaw, instruction });
      const center = worldPosition(
        origin,
        { x: Math.floor(instruction.dimensions.width / 2), y: 0, z: 0, block: "stone" },
        0,
        instruction.dimensions.width,
        instruction.dimensions.depth,
      );
      const dx = center.x - 10;
      const dz = center.z - -30;
      const distance = Math.abs(dx) + Math.abs(dz);
      assert.equal(distance, 20, `distance for yaw ${yaw} ${direction}`);
      assert.ok(dx === 0 || dz === 0);
    }
  }
});

test("build plans are bounded, counted, and refused outside the world", () => {
  const house = buildPlan(parseCommand("build a small oak house"));
  assert.ok(house.count > 10);
  assert.ok(house.count < 20_000);
  assert.ok(house.materials.includes("oak_planks"));
  const tower = buildPlan(parseCommand("build a stone tower"));
  assert.ok(tower.count > house.count / 4);
  assert.equal(worldBoundsError(300, 20), null);
  assert.match(worldBoundsError(319, 10), /above/);
  assert.throws(() => buildPlan(parseCommand("build a house 80 by 80 by 80")), /not valid|exceeds/);
});

test("fill runs stay inside the vanilla volume limit and block ids are checked", () => {
  const runs = toFillRuns([
    { x: 0, y: 1, z: 2, block: "stone" },
    { x: 1, y: 1, z: 2, block: "stone" },
    { x: 3, y: 1, z: 2, block: "stone" },
  ]);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].count, 2);
  assert.equal(assertBlockId("oak_planks"), "minecraft:oak_planks");
  assert.throws(() => assertBlockId("oak planks; say"), /Invalid block id/);
});

test("cancellation and partial failure are reported separately from success", async () => {
  const job = { cancelled: false, paused: false };
  let calls = 0;
  const cancelled = await executeOperations({
    operations: [1, 2, 3, 4, 5],
    job,
    placeOne: async () => {
      calls += 1;
      if (calls === 2) job.cancelled = true;
      return { ok: true };
    },
  });
  assert.equal(cancelled.status, "cancelled");
  assert.ok(cancelled.placed < 5);
  assert.notEqual(finalStatus({ cancelled: true, failed: 0, placed: 2, requested: 5 }), "completed");

  const partial = await executeOperations({
    operations: ["a", "b", "c"],
    job: { cancelled: false },
    placeOne: async (_op, index) => ({ ok: index !== 1 }),
  });
  assert.equal(partial.status, "completed_with_errors");
  assert.equal(partial.failed, 1);
  assert.equal(partial.placed, 2);
  assert.ok(partial.progress < 100);
});

test("terrain survey reports real samples and protected blocks", () => {
  const world = new Map([
    ["0,63,0", "grass_block"],
    ["1,64,0", "water"],
    ["0,65,1", "oak_log"],
    ["1,65,1", "chest"],
  ]);
  const report = surveyTerrain({
    origin: { x: 0, y: 64, z: 0 },
    width: 2,
    depth: 2,
    height: 3,
    sampler: (x, y, z) => world.get(`${x},${y},${z}`) || "air",
  });
  assert.ok(report.water >= 1);
  assert.ok(report.trees >= 1);
  assert.equal(report.protectedCount, 1);
  assert.equal(report.protectedBlocks[0].block, "chest");
  assert.equal(report.requiresApproval, true);
});

test("undo skips blocks the player changed and refuses protected containers", () => {
  const changes = [
    { x: 1, y: 2, z: 3, before: "grass_block", after: "stone" },
    { x: 2, y: 2, z: 3, before: "dirt", after: "stone" },
    { x: 3, y: 2, z: 3, before: "chest", after: "air" },
  ];
  const current = new Map([
    ["1,2,3", "stone"],
    ["2,2,3", "oak_planks"],
    ["3,2,3", "air"],
  ]);
  const undo = planUndo(changes, (change) => current.get(`${change.x},${change.y},${change.z}`));
  assert.equal(undo.operations.length, 1);
  assert.equal(undo.operations[0].block, "grass_block");
  assert.equal(undo.conflicts.length, 1);
  assert.equal(undo.excluded.length, 1);
  const redo = planRedo(
    [{ x: 1, y: 2, z: 3, before: "grass_block", after: "stone" }],
    () => "grass_block",
  );
  assert.equal(redo.operations[0].block, "stone");
});

test("state machine does not treat cancellation as completion", () => {
  assert.equal(transition("idle", "planning").state, "planning");
  assert.equal(transition("awaiting_approval", "building").ok, true);
  assert.equal(transition("building", "cancelling").ok, true);
  assert.equal(transition("cancelling", "completed").ok, false);
  assert.equal(transition("building", "completed").ok, true);
  assert.equal(transition("cancelled", "completed").ok, false);
});

test("entitlements enforce plan, task, block, and tester rules", async () => {
  const starter = { plan_tier: "starter", subscription_status: "active", unlimited_tester: false };
  assert.equal(evaluateEntitlement({ profile: starter, usage: { task_count: 0, block_count: 0 }, requestedBlocks: 100 }).allowed, true);
  assert.equal(
    evaluateEntitlement({ profile: { ...starter, subscription_status: "canceled" }, usage: { task_count: 0, block_count: 0 }, requestedBlocks: 10 }).code,
    "subscription_required",
  );
  assert.equal(
    evaluateEntitlement({ profile: { plan_tier: "nope", subscription_status: "active" }, usage: { task_count: 0, block_count: 0 }, requestedBlocks: 10 }).code,
    "invalid_subscription",
  );
  assert.equal(
    evaluateEntitlement({ profile: starter, usage: { task_count: 5, block_count: 0 }, requestedBlocks: 10 }).code,
    "daily_task_limit",
  );
  assert.equal(
    evaluateEntitlement({ profile: starter, usage: { task_count: 0, block_count: 4900 }, requestedBlocks: 200 }).code,
    "daily_block_limit",
  );
  assert.equal(
    evaluateEntitlement({
      profile: { plan_tier: "starter", subscription_status: "inactive", unlimited_tester: true },
      usage: { task_count: 0, block_count: 0 },
      requestedBlocks: 10,
    }).planTier,
    "unlimited_tester",
  );
  assert.equal(
    evaluateEntitlement({
      profile: { plan_tier: "architect", subscription_status: "active", unlimited_tester: false },
      usage: { task_count: 0, block_count: 0 },
      requestedBlocks: 10,
    }).allowed,
    true,
  );

  const stateRef = {
    current: { profile: starter, usage: { task_count: 4, block_count: 0 } },
  };
  const reserve = createReservationGate();
  const [first, second] = await Promise.all([reserve(stateRef, 10), reserve(stateRef, 10)]);
  const codes = [first, second].map((result) => result.allowed);
  assert.deepEqual(codes.sort(), [false, true]);
});

test("failed builds with no placements can release a reservation; partial builds cannot", () => {
  const starter = { plan_tier: "starter", subscription_status: "active", unlimited_tester: false };
  const reserved = applyReservation({ profile: starter, usage: { task_count: 0, block_count: 0 } }, 100);
  assert.equal(reserved.state.usage.task_count, 1);
  const refunded = releaseReservation(reserved.state, 100, 0);
  assert.equal(refunded.usage.task_count, 0);
  assert.equal(refunded.usage.block_count, 0);
  const kept = releaseReservation(reserved.state, 100, 4);
  assert.equal(kept.usage.block_count, 100);
});

test("runner tokens reject invalid, expired, mismatched, and replayed credentials", () => {
  const secret = "a".repeat(40);
  const issued = issueRunnerToken("user-1", secret, { deviceId: "device-1", now: 1_000, lifetimeSeconds: 50 });
  assert.equal(verifyRunnerToken(issued.token, secret, { now: 1_010 }).ok, true);
  assert.equal(verifyRunnerToken(`${issued.token}x`, secret, { now: 1_010 }).code, "invalid_runner_token");
  assert.equal(verifyRunnerToken(issued.token, secret, { now: 2_000 }).code, "expired_runner_token");
  assert.equal(
    verifyRunnerToken(issued.token, secret, { now: 1_010, expectedDeviceId: "other" }).code,
    "device_mismatch",
  );
  const seen = new Set();
  const first = verifyRunnerToken(issued.token, secret, {
    now: 1_010,
    isConsumed: (jti) => seen.has(jti),
  });
  seen.add(first.payload.jti);
  assert.equal(
    verifyRunnerToken(issued.token, secret, { now: 1_010, isConsumed: (jti) => seen.has(jti) }).code,
    "replayed_runner_token",
  );
});

test("command envelopes reject malformed, expired, and replayed requests", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const instruction = parseCommand("preview a stone house");
  const envelope = {
    v: 1,
    id: "6f1b3c2e-7a7e-4c1d-9c2a-0b1d2e3f4a5b",
    jobId: "11111111-2222-4333-8444-555555555555",
    deviceId: "device-1234",
    action: "command",
    instruction,
    iat: 10_000,
    exp: 20_000,
    nonce: "nonce-value-0001",
  };
  envelope.signature = sign(null, envelopeSigningBytes(envelope), privateKey).toString("base64url");
  const seen = new Set();
  const ok = verifyCommandEnvelope(envelope, { now: 15_000, seenNonces: seen, publicKeyPem: pem, expectedDeviceId: "device-1234" });
  assert.equal(ok.ok, true);
  assert.equal(ok.instruction.approved, false);
  const replay = verifyCommandEnvelope(envelope, { now: 15_000, seenNonces: seen, publicKeyPem: pem });
  assert.equal(replay.code, "replayed_command");
  const expired = verifyCommandEnvelope({ ...envelope, nonce: "nonce-value-0002", exp: 14_000 }, { now: 15_000, seenNonces: new Set(), publicKeyPem: pem });
  assert.equal(expired.code, "expired_envelope");
  assert.equal(verifyCommandEnvelope({ hello: "no" }, { now: 1, seenNonces: new Set() }).code, "malformed_envelope");
});

test("chat commands are denied by default and do not trust offline names", () => {
  assert.equal(evaluateChatCommand({ username: "Steve", action: "build" }).reason, "chat_disabled");
  assert.equal(
    evaluateChatCommand({
      enabled: true,
      username: "Steve",
      allowlist: ["steve"],
      authMode: "offline",
      action: "build",
    }).reason,
    "offline_identity_untrusted",
  );
  const allowed = evaluateChatCommand({
    enabled: true,
    username: "Steve",
    allowlist: ["Steve"],
    authMode: "microsoft",
    action: "preview",
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.allowDestructive, false);
  const decision = decideDispatch(parseCommand("build a house"), {
    authorized: true,
    chat: { allowed: true, allowDestructive: false },
  });
  assert.equal(decision.reason, "chat_destructive_blocked");
});

test("pkce and loopback redirects reject off-host callbacks", () => {
  const pkce = createPkce();
  assert.equal(verifyPkce(pkce.verifier, pkce.challenge), true);
  assert.equal(verifyPkce("other", pkce.challenge), false);
  assert.equal(isAllowedLoopbackRedirect("http://127.0.0.1:43123/callback"), true);
  assert.equal(isAllowedLoopbackRedirect("https://evil.example/callback"), false);
  assert.equal(isAllowedLoopbackRedirect("http://127.0.0.1:43123/steal"), false);
});

test("blueprint json round-trips and external schematics are rejected honestly", () => {
  const raw = exportBlueprint({
    name: "Gatehouse",
    category: "defense",
    structure: "castle",
    material: "stone_bricks",
    size: "medium",
    floors: 1,
    dimensions: { width: 25, depth: 25, height: 8 },
  });
  const imported = importBlueprint(raw);
  assert.equal(imported.ok, true);
  assert.equal(imported.blueprint.name, "Gatehouse");
  assert.equal(importBlueprint("{").ok, false);
  const schem = identifyExternalSchematic(Buffer.from([0x1f, 0x8b, 0x00]));
  assert.equal(schem.ok, false);
  assert.match(schem.error, /not imported/);
});

test("ollama plans must match the constrained schema and become normal instructions", () => {
  const valid = validatePlannerResponse(
    JSON.stringify({
      summary: "Courtyard castle",
      parts: [{ structure: "castle", material: "stone_bricks", size: "large", floors: 1 }],
    }),
  );
  assert.equal(valid.ok, true);
  const instruction = planToInstruction(valid.plan.parts[0], "castle");
  assert.equal(instruction.structure, "castle");
  assert.equal(instruction.approved, false);
  const hostile = validatePlannerResponse(
    JSON.stringify({
      summary: "run commands",
      parts: [{ structure: "castle" }],
      commands: ["/op attacker"],
    }),
  );
  assert.equal(hostile.ok, false);
  assert.equal(isLocalOllamaUrl("http://127.0.0.1:11434"), true);
  assert.equal(isLocalOllamaUrl("https://api.openai.com"), false);
  assert.equal(isLocalOllamaModel("llama3.2:3b"), true);
  assert.equal(isLocalOllamaModel("gpt-oss:120b-cloud"), false);
});

test("local bridge payload limits and approval cannot be self-asserted", async () => {
  const { assessPayload } = await import("../packages/protocol/src/security.js");
  const { sanitizeInstruction } = await import("../packages/protocol/src/schema.js");
  assert.equal(assessPayload("x".repeat(300_000)).code, "payload_too_large");
  const instruction = parseCommand("build a house");
  const forged = sanitizeInstruction({ ...instruction, approved: true });
  assert.equal(forged.ok, true);
  assert.equal(forged.instruction.approved, false);
});
