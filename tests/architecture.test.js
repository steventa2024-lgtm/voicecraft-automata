import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateTemplate, listTemplates } from "../packages/protocol/src/templates.js";
import { SHOWCASE_DEFAULTS } from "../packages/protocol/src/showcase.js";
import { blockKey, canonicalStates, commandBlock } from "../packages/protocol/src/block-state.js";
import { blockCuboids } from "../packages/protocol/src/block-shapes.js";
import {
  planFingerprint,
  rotateBlocks,
  mirrorBlocks,
  assertSamePlan,
} from "../packages/protocol/src/blueprint-edit.js";
import { buildPlan } from "../packages/protocol/src/plan.js";
import { sanitizeInstruction } from "../packages/protocol/src/schema.js";
import { toFillRuns } from "../packages/protocol/src/execution.js";
import { planUndo } from "../packages/protocol/src/history.js";
import { worldPosition, worldPlanBounds } from "../packages/protocol/src/coordinates.js";
import { EventEmitter } from "node:events";
import { placeBlocks } from "../bridge/placer.js";
import { isProtectedBlock, MAX_OPERATIONS } from "../packages/protocol/src/limits.js";

for (const id of Object.keys(SHOWCASE_DEFAULTS)) {
  test(`${id}: detailed, canonical, bounded and state-valid architecture`, () => {
    const plan = generateTemplate(id),
      before = JSON.parse(
        fs.readFileSync(
          new URL(`../docs/architecture-verification/${id}-before.json`, import.meta.url),
        ),
      );
    const solid = plan.blocks.filter((b) => b.block !== "air");
    assert.ok(solid.length > before.blocks.filter((b) => b.block !== "air").length * 3);
    assert.ok(new Set(solid.map((b) => b.block)).size >= 9);
    assert.ok(plan.count < 20_000);
    assert.equal(new Set(plan.blocks.map((b) => `${b.x},${b.y},${b.z}`)).size, plan.count);
    assert.equal(generateTemplate(id).fingerprint, plan.fingerprint);
    const cells = new Map(plan.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
    for (const b of plan.blocks) {
      canonicalStates(b.block, b.states);
      assert.ok(b.x >= plan.bounds.min.x && b.x <= plan.bounds.max.x);
      assert.ok(b.y >= plan.bounds.min.y && b.y <= plan.bounds.max.y);
      assert.ok(b.z >= plan.bounds.min.z && b.z <= plan.bounds.max.z);
      for (const part of blockCuboids(b)) assert.ok(part.every(Number.isFinite));
      if (b.block.endsWith("_door")) {
        const other = cells.get(`${b.x},${b.y + (b.states.half === "lower" ? 1 : -1)},${b.z}`);
        assert.equal(other?.block, b.block, `Unpaired door at ${b.x},${b.y},${b.z}`);
        assert.notEqual(other.states.half, b.states.half);
      }
    }
    const parsed = sanitizeInstruction({
      action: "build",
      templateId: id,
      templateOptions: plan.settings,
    });
    assert.equal(parsed.ok, true);
    assert.equal(buildPlan(parsed.instruction).fingerprint, plan.fingerprint);
    assert.equal(planFingerprint(rotateBlocks(plan.blocks, 4)), plan.fingerprint);
    assert.equal(
      planFingerprint(mirrorBlocks(mirrorBlocks(plan.blocks, "x"), "x")),
      plan.fingerprint,
    );
    for (const options of [
      { width: plan.settings.width + 2 },
      { depth: plan.settings.depth + 2 },
      { material: "quartz_block" },
      { rotation: 1 },
      { mirror: "x" },
      { placement: "floating", elevation: 5 },
    ]) {
      const edited = generateTemplate(id, options);
      assert.notEqual(edited.fingerprint, plan.fingerprint, JSON.stringify(options));
      assert.throws(() => assertSamePlan(plan, edited.blocks), /no longer matches/);
      for (const b of edited.blocks) canonicalStates(b.block, b.states);
    }
  });
}
test("orientation is part of approval identity, fill batching, mirror and world coordinates", () => {
  const a = {
    x: 0,
    y: 1,
    z: 0,
    block: "oak_stairs",
    states: { facing: "north", half: "bottom", shape: "inner_left", waterlogged: "false" },
  };
  const b = { ...a, x: 1, states: { ...a.states, facing: "east" } };
  assert.equal(toFillRuns([a, b]).length, 2);
  assert.match(
    commandBlock(a),
    /^minecraft:oak_stairs\[facing=north,half=bottom,shape=inner_left,waterlogged=false\]$/,
  );
  assert.notEqual(planFingerprint([a]), planFingerprint([{ ...a, states: b.states }]));
  assert.equal(rotateBlocks([a], 1)[0].states.facing, "east");
  assert.equal(mirrorBlocks([a], "x")[0].states.shape, "inner_right");
  const origin = { x: 5, y: 60, z: 5, right: { x: -1, z: 0 }, buildDir: { x: 0, z: 1 } };
  assert.equal(worldPosition(origin, b, 0, 1, 1).states.facing, "west");
  assert.equal(worldPosition(origin, a, 0, 1, 1).states.shape, "inner_right");
  const plan = generateTemplate("lakeside-cottage"),
    i = { dimensions: plan.bounds, rotation: 1 };
  const bounds = worldPlanBounds(origin, plan, i);
  for (const b of plan.blocks) {
    const p = worldPosition(origin, b, 1, plan.bounds.width, plan.bounds.depth);
    assert.ok(
      p.x >= bounds.min.x && p.x <= bounds.max.x && p.z >= bounds.min.z && p.z <= bounds.max.z,
    );
  }
  assert.throws(() => blockKey({ ...a, states: { facing: "north] destroy" } }), /Invalid/);
  assert.throws(() => blockKey({ ...a, block: "not_a_real_block" }), /Unknown/);
});
test("undo restores block properties and detects state-only player edits", () => {
  const change = {
    x: 0,
    y: 0,
    z: 0,
    before: "oak_stairs",
    beforeStates: { facing: "east" },
    after: "oak_stairs",
    afterStates: { facing: "west" },
  };
  const current = (facing) => ({ name: "oak_stairs", getProperties: () => ({ facing }) });
  assert.deepEqual(planUndo([change], () => current("west")).operations[0].states, {
    facing: "east",
  });
  assert.equal(planUndo([change], () => current("north")).conflicts.length, 1);
});

test("all fifty compositions remain valid at both resize limits and every orientation", () => {
  const fingerprints = new Set();
  for (const template of listTemplates()) {
    fingerprints.add(generateTemplate(template.id).fingerprint);
    for (const options of [
      { width: template.ranges.width[0], depth: template.ranges.depth[0] },
      { width: template.ranges.width[1], depth: template.ranges.depth[1], rotation: 1 },
      { rotation: 2, mirror: "x" },
      { rotation: 3, mirror: "z" },
    ]) {
      const plan = generateTemplate(template.id, options);
      assert.ok(plan.count > 100 && plan.count < MAX_OPERATIONS, template.id);
      assert.ok(
        plan.bounds.height < 96 && plan.bounds.width < 64 && plan.bounds.depth < 64,
        template.id,
      );
      const cells = new Map(plan.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
      for (const b of plan.blocks) {
        canonicalStates(b.block, b.states);
        assert.equal(isProtectedBlock(b.block), false);
        if (b.block.endsWith("_door")) {
          const other = cells.get(`${b.x},${b.y + (b.states.half === "lower" ? 1 : -1)},${b.z}`);
          assert.equal(other?.block, b.block, template.id + " door pair");
          assert.notEqual(other.states.half, b.states.half);
        }
      }
    }
  }
  assert.equal(fingerprints.size, 50);
});
test("command adapter places and verifies oriented cells, and fails closed before unsupported placement", async () => {
  const bot = new EventEmitter(),
    world = new Map(),
    commands = [];
  bot.registry = { blocksByName: { oak_stairs: {}, air: {}, stone: {} } };
  bot.blockAt = (pos) =>
    world.get(`${pos.x},${pos.y},${pos.z}`) || { name: "air", getProperties: () => ({}) };
  bot.chat = (command) => {
    commands.push(command);
    const match = command.match(
      /^\/(setblock|fill) (.+) minecraft:([a-z_]+)(?:\[([^\]]+)\])? replace$/,
    );
    assert.ok(match, command);
    const coords = match[2].split(" ").map(Number),
      states = Object.fromEntries(
        (match[4] || "")
          .split(",")
          .filter(Boolean)
          .map((s) => s.split("=")),
      );
    for (let x = coords[0]; x <= (coords[3] ?? coords[0]); x++)
      world.set(`${x},${coords[1]},${coords[2]}`, { name: match[3], getProperties: () => states });
  };
  const blocks = [0, 1, 2].map((x) => ({
    x,
    y: 64,
    z: 0,
    block: "oak_stairs",
    states: { facing: "east", half: "bottom", shape: "straight", waterlogged: "false" },
  }));
  const result = await placeBlocks(
    bot,
    blocks,
    null,
    { cancelled: false, paused: false },
    null,
    "command",
  );
  assert.equal(commands.length, 1);
  assert.equal(result.placed, 3);
  assert.equal(result.failed, 0);
  assert.equal(result.verified.sampled, 3);
  assert.equal(result.status, "completed");
  await assert.rejects(
    () => placeBlocks(bot, blocks, null, {}, null, "creative"),
    /requires command placement/,
  );
  await assert.rejects(
    () =>
      placeBlocks(bot, [{ ...blocks[0], states: { facing: "bad" } }], null, {}, null, "command"),
    /Invalid/,
  );
  assert.equal(commands.length, 1);
  bot.chat = (command) => commands.push(command); // A server that never applies the command must not report success.
  const failed = await placeBlocks(
    bot,
    [{ x: 5, y: 64, z: 0, block: "stone" }],
    null,
    {},
    null,
    "command",
  );
  assert.equal(failed.placed, 0);
  assert.equal(failed.failed, 1);
  assert.equal(failed.status, "failed");
});
