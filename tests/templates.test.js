import assert from "node:assert/strict";
import test from "node:test";
import { assertSamePlan, planFingerprint, rotateBlocks } from "../packages/protocol/src/blueprint-edit.js";
import { isProtectedBlock } from "../packages/protocol/src/limits.js";
import { partitionProtectedTargets } from "../packages/protocol/src/plan.js";
import { exportBlueprint, importBlueprint } from "../packages/protocol/src/blueprints.js";
import { buildPlan } from "../packages/protocol/src/plan.js";
import { generateTemplate, isometricPreview, listTemplates } from "../packages/protocol/src/templates.js";

const CATEGORIES = [
  "Homes & Cabins",
  "Modern & Luxury",
  "Medieval & Fortified",
  "Fantasy & Magic",
  "Village & Community",
  "Farms & Nature",
  "Infrastructure",
  "Temples & Monuments",
  "Industry & Utility",
  "Creative & Recreation",
];

test("the shared catalog has 50 distinct buildable presets", () => {
  const templates = listTemplates();
  assert.equal(templates.length, 50);
  assert.equal(new Set(templates.map((template) => template.id)).size, 50);
  assert.deepEqual(new Set(templates.map((template) => template.category)), new Set(CATEGORIES));
  const shapes = new Set();
  for (const template of templates) {
    assert.equal(template.generatorId, template.id);
    assert.ok(template.estimatedBlocks > 0);
    assert.ok(template.bounds.width > 0 && template.bounds.depth > 0 && template.bounds.height > 0);
    const plan = generateTemplate(template.id);
    assert.equal(plan.count, template.estimatedBlocks);
    assert.equal(plan.fingerprint, planFingerprint(plan.blocks));
    assert.equal(generateTemplate(template.id).fingerprint, plan.fingerprint);
    const shape = plan.blocks
      .filter((block) => block.block !== "air")
      .map((block) => `${block.x},${block.y},${block.z}`)
      .sort()
      .join("|");
    assert.ok(shape.length > 0);
    shapes.add(shape);
    const preview = isometricPreview(plan.blocks);
    assert.ok(preview.cells.length > 0);
    for (const block of plan.blocks) assert.match(block.block, /^[a-z0-9_]+$/);
  }
  assert.equal(shapes.size, 50);
});

test("editing a template invalidates the previous approval fingerprint", () => {
  const original = generateTemplate("windmill");
  const rotated = generateTemplate("windmill", { rotation: 1 });
  assert.notEqual(original.fingerprint, rotated.fingerprint);
  assert.equal(planFingerprint(rotateBlocks(original.blocks, 1)), rotated.fingerprint);
  const instruction = {
    valid: true,
    action: "build",
    structure: "house",
    templateId: "lighthouse",
    templateOptions: { rotation: 0 },
    dimensions: { width: 11, depth: 11, height: 12 },
    material: "white_concrete",
    floors: 1,
  };
  const plan = buildPlan(instruction);
  assert.equal(plan.templateId, "lighthouse");
  assert.doesNotThrow(() => assertSamePlan({ fingerprint: plan.fingerprint, count: plan.count }, plan.blocks));
  assert.throws(() => assertSamePlan({ fingerprint: "ffff", count: plan.count }, plan.blocks), /no longer matches/);
});

test("named presets include their distinctive geometry", () => {
  const treehouse = generateTemplate("forest-treehouse");
  assert.ok(treehouse.blocks.some((block) => block.y >= 8 && block.block === "oak_planks"));
  const windmill = generateTemplate("windmill");
  assert.ok(windmill.blocks.filter((block) => block.block === "oak_fence").length >= 8);
  const lighthouse = generateTemplate("lighthouse");
  assert.ok(lighthouse.blocks.some((block) => block.block === "sea_lantern"));
  assert.ok(lighthouse.blocks.some((block) => block.block === "glass" && block.y >= 9));
  const bridge = generateTemplate("suspension-bridge");
  assert.ok(bridge.blocks.some((block) => block.block === "chain"));
  assert.ok(bridge.blocks.some((block) => block.y >= 3 && block.block === "oak_planks"));
  const island = generateTemplate("floating-island");
  assert.ok(island.blocks.some((block) => block.block === "grass_block" && block.y >= 8));
  assert.ok(island.blocks.some((block) => block.block === "chain"));
  const market = generateTemplate("market-hall");
  assert.ok(market.blocks.filter((block) => block.block === "red_wool").length >= 4);
  const greenhouse = generateTemplate("greenhouse");
  assert.ok(greenhouse.blocks.some((block) => block.block === "farmland"));
  assert.ok(greenhouse.blocks.some((block) => block.block === "glass"));
  const depot = generateTemplate("railway-depot");
  assert.ok(depot.blocks.some((block) => block.block === "rail"));
  const maze = generateTemplate("hedge-maze");
  assert.ok(maze.blocks.some((block) => block.block === "oak_leaves"));
  const arena = generateTemplate("pvp-arena");
  assert.ok(arena.blocks.some((block) => block.block === "sand"));
  const farm = listTemplates().find((template) => template.id === "crop-farm");
  assert.equal(farm.name, "Crop Farm");
  assert.match(farm.warnings.join(" "), /not a redstone harvester/);
});

test("protected containers are left out of placement", () => {
  for (const template of listTemplates()) {
    const plan = generateTemplate(template.id);
    assert.equal(plan.blocks.some((block) => isProtectedBlock(block.block)), false);
  }
  const split = partitionProtectedTargets(
    [
      { x: 0, y: 0, z: 0, block: "chest" },
      { x: 1, y: 0, z: 0, block: "oak_planks" },
      { x: 2, y: 0, z: 0, block: "air" },
    ],
    (block) => (block.x === 2 ? "barrel" : "stone"),
  );
  assert.deepEqual(split.place.map((block) => block.block), ["oak_planks"]);
  assert.equal(split.skipped.length, 2);
});

test("a saved template blueprint keeps its generator options", () => {
  const text = exportBlueprint({
    name: "Coastal Lighthouse",
    category: "Infrastructure",
    structure: "house",
    material: "stone_bricks",
    size: "medium",
    floors: 1,
    dimensions: { width: 11, depth: 11, height: 16 },
    templateId: "lighthouse",
    templateOptions: { width: 11, depth: 11, floors: 1, material: "white_concrete", rotation: 1, mirror: null },
  });
  const imported = importBlueprint(text);
  assert.equal(imported.ok, true);
  assert.equal(imported.blueprint.templateId, "lighthouse");
  assert.equal(imported.blueprint.templateOptions.rotation, 1);
});
