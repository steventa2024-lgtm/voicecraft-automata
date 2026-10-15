import assert from "node:assert/strict";
import test from "node:test";
import { generateTemplate, listTemplates } from "../packages/protocol/src/templates.js";
import { buildPlan, assertPlanFitsWorld } from "../packages/protocol/src/plan.js";
import { sanitizeInstruction } from "../packages/protocol/src/schema.js";
import { exportBlueprint, importBlueprint } from "../packages/protocol/src/blueprints.js";
import { createApprovalGate } from "../mobile/src/lib/approval-gate.js";
import {
  readLocalBlueprints,
  saveLocalBlueprint,
  manageLocalBlueprint,
  LOCAL_BLUEPRINTS_KEY,
} from "../mobile/src/lib/local-blueprints.js";
import { createStatusMonitor, pcActionEnabled } from "../mobile/src/lib/status-monitor.js";
import { voxelScene, materialColor } from "../mobile/src/lib/voxel-scene.js";
import { nextJobStatus } from "../desktop/electron/job-status.js";
import { createBridgeRuntime } from "../bridge/runtime.js";
import { templateControls } from "../mobile/src/lib/template-controls.js";
const storage = () => {
  const values = new Map();
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
};

test("editor exposes only dimensions and materials that its template actually supports", () => {
  const get = (id) => templateControls(listTemplates().find((t) => t.id === id));
  assert.deepEqual(get("forest-treehouse"), {
    width: false,
    depth: false,
    floors: false,
    material: false,
  });
  assert.deepEqual(get("lakeside-cottage"), {
    width: true,
    depth: true,
    floors: false,
    material: true,
  });
  assert.equal(get("stone-keep").material, false);
});

test("placement raises canonical cells and changes the preview and approval identity", () => {
  const ground = generateTemplate("lakeside-cottage");
  const raised = generateTemplate("lakeside-cottage", { placement: "floating", elevation: 7 });
  assert.equal(raised.count, ground.count);
  assert.notEqual(raised.fingerprint, ground.fingerprint);
  assert.deepEqual(
    raised.blocks,
    ground.blocks.map((b) => ({ ...b, y: b.y + 7 })),
  );
  assert.equal(raised.bounds.min.y, ground.bounds.min.y + 7);
  assert.throws(
    () => generateTemplate("lakeside-cottage", { placement: "water" }),
    /not supported/,
  );
  assert.throws(() => assertPlanFitsWorld(312, raised), /above/);
  assert.throws(() => assertPlanFitsWorld(-64, ground), /below/);
  assert.equal(
    generateTemplate("lakeside-cottage", { placement: "floating", elevation: 999 }).settings
      .elevation,
    16,
  );
  assert.notDeepEqual(voxelScene(ground.blocks).paths, voxelScene(raised.blocks).paths);
});

test("late, mismatched, reused and edited approvals cannot authorize a build", () => {
  const gate = createApprovalGate(),
    plan = generateTemplate("windmill");
  const response = { ...plan, requiresConfirmation: true };
  let ticket = gate.begin(plan, "pc-a");
  gate.invalidate();
  assert.equal(gate.accept(ticket, response, plan, "pc-a"), false);
  ticket = gate.begin(plan, "pc-a");
  assert.equal(gate.accept(ticket, response, plan, "pc-b"), false);
  assert.throws(() => gate.accept(ticket, { ...response, count: 1 }, plan, "pc-a"), /differs/);
  assert.equal(gate.accept(ticket, response, plan, "pc-a"), true);
  const edited = generateTemplate("windmill", { placement: "floating" });
  assert.equal(gate.matches(edited, "pc-a"), false);
  assert.equal(gate.consume(plan, "pc-a"), true);
  assert.equal(gate.consume(plan, "pc-a"), false);
});

test("local library migrates old records and preserves edits, rename, favorites, copies and deletion", () => {
  const db = storage();
  db.setItem(
    LOCAL_BLUEPRINTS_KEY,
    JSON.stringify([
      { templateId: "lakeside-cottage", name: "Old cottage", options: { rotation: 1 } },
    ]),
  );
  const old = readLocalBlueprints(db)[0];
  assert.equal(old.id, "legacy-lakeside-cottage");
  const saved = saveLocalBlueprint(
    {
      ...old,
      name: "Raised cottage",
      options: { ...old.options, placement: "floating", elevation: 6 },
    },
    db,
  );
  assert.equal(readLocalBlueprints(db).length, 1);
  assert.equal(readLocalBlueprints(db)[0].options.elevation, 6);
  assert.notEqual(saved.fingerprint, old.fingerprint);
  manageLocalBlueprint(saved.id, "rename", "My island", db);
  manageLocalBlueprint(saved.id, "favorite", undefined, db);
  const copy = manageLocalBlueprint(saved.id, "duplicate", undefined, db);
  assert.notEqual(copy.id, saved.id);
  assert.equal(copy.fingerprint, saved.fingerprint);
  assert.equal(readLocalBlueprints(db).find((x) => x.id === saved.id).favorite, true);
  manageLocalBlueprint(copy.id, "delete", undefined, db);
  assert.equal(readLocalBlueprints(db).length, 1);
  assert.equal(readLocalBlueprints(db)[0].name, "My island");
  assert.throws(() => manageLocalBlueprint(saved.id, "rename", "  ", db), /name/);
});

test("a failed connection refresh clears old online data and late replies cannot revive it", async () => {
  let fail = false,
    resolve;
  let snapshot = {};
  const monitor = createStatusMonitor(
    async () => {
      if (fail) throw new Error("Offline");
      return { name: "PC" };
    },
    (patch) => (snapshot = { ...snapshot, ...patch }),
  );
  await monitor.refresh();
  assert.equal(snapshot.data.name, "PC");
  fail = true;
  await monitor.refresh();
  assert.equal(snapshot.data, null);
  assert.equal(snapshot.error, "Offline");
  assert.ok(snapshot.lastSuccess);
  const slow = createStatusMonitor(
    () => new Promise((r) => (resolve = r)),
    (patch) => (snapshot = { ...snapshot, ...patch }),
  );
  const pending = slow.refresh();
  slow.clear();
  resolve({ name: "Late PC" });
  await pending;
  assert.equal(snapshot.data, null);
});

test("PC controls use actual permissions and job state; progress-only events preserve counts", () => {
  const online = {
    permissions: { build: true },
    bridgeRunning: true,
    activeJob: { status: "building" },
  };
  assert.equal(pcActionEnabled("pause", online), true);
  assert.equal(pcActionEnabled("resume", online), false);
  assert.equal(pcActionEnabled("pause", { ...online, permissions: { build: false } }), false);
  assert.equal(pcActionEnabled("cancel", null), false);
  let status = nextJobStatus(null, { type: "plan", count: 1000 });
  status = nextJobStatus(status, { type: "progress", requested: 1000, placed: 670 });
  assert.equal(status.progress, 67);
  assert.equal(status.status, "building");
  assert.equal(status.count, 1000);
  status = nextJobStatus(status, { type: "state", state: "paused" });
  assert.equal(status.status, "paused");
  assert.equal(status.progress, 67);
  assert.equal(nextJobStatus(status, { type: "plan", count: 500 }).progress, 0);
});

test("camera views preserve every solid cell and renderer output is deterministic for all templates", () => {
  assert.equal(materialColor("stone_bricks"), materialColor("stone"));
  assert.notEqual(materialColor("stone_bricks"), materialColor("bricks"));
  for (const template of listTemplates()) {
    const plan = generateTemplate(template.id),
      before = JSON.stringify(plan.blocks);
    const count = plan.blocks.filter((b) => b.block !== "air").length;
    const first = voxelScene(plan.blocks, 320, 240, 0);
    assert.equal(first.visibleBlocks, count);
    assert.ok(first.paths.length > 0);
    assert.deepEqual(first, voxelScene(plan.blocks, 320, 240, 0));
    for (const camera of [1, 2, 3])
      assert.equal(voxelScene(plan.blocks, 320, 240, camera).visibleBlocks, count);
    assert.equal(JSON.stringify(plan.blocks), before);
    assert.ok(first.paths.every((p) => !p.d.includes("NaN")));
  }
});

test("known template instructions reach the authorized bridge, retaining placement and requiring approval", async () => {
  const events = [],
    placed = [];
  const bridge = createBridgeRuntime({
    authToken: "test-token-that-is-long-enough",
    botReady: true,
    onEvent: (e) => events.push(e),
    getPlayer: () => ({ x: 0, y: 80, z: 0, yaw: 0 }),
    sampleBlock: () => "air",
    authorize: async () => ({ allowed: true }),
    place: async ({ plan }) => {
      placed.push(plan);
      return { status: "completed", placed: plan.count, failed: 0 };
    },
  });
  const input = {
    templateId: "lakeside-cottage",
    templateOptions: { placement: "floating", elevation: 5 },
    action: "build",
    approved: true,
    protectedBlockPolicy: "skip",
  };
  const normalized = sanitizeInstruction(input);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.instruction.approved, false);
  assert.equal(normalized.instruction.protectedBlockPolicy, "abort");
  assert.equal(
    sanitizeInstruction({ ...input, templateOptions: { placement: "water" } }).ok,
    false,
  );
  assert.equal(sanitizeInstruction({ ...input, templateId: "made-up" }).ok, false);
  await bridge.handleMessage({ authenticated: true }, { type: "command", instruction: input });
  const preview = events.find((e) => e.type === "plan");
  assert.ok(preview);
  assert.equal(placed.length, 0);
  assert.equal(
    preview.fingerprint,
    generateTemplate(input.templateId, input.templateOptions).fingerprint,
  );
  await bridge.handleMessage(
    { authenticated: true },
    { type: "approve", jobId: preview.jobId, runnerToken: "test" },
  );
  assert.equal(placed.length, 1);
  assert.equal(placed[0].fingerprint, preview.fingerprint);
});
