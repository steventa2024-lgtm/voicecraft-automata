import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { openStore } from "../bridge/store.js";
import { deriveSessionId } from "../bridge/relay.js";
import { generateKeyPairSync } from "node:crypto";

test("build history undo ignores newer player edits", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "zp-store-"));
  const store = openStore(dir);
  try {
    store.recordBuild(
      {
        worldKey: "localhost:25565:overworld",
        action: "build",
        structure: "house",
        material: "oak_planks",
        status: "completed",
        placed: 2,
        failed: 0,
        blockCount: 2,
      },
      [
        { x: 1, y: 64, z: 2, before: "grass_block", after: "oak_planks" },
        { x: 2, y: 64, z: 2, before: "dirt", after: "oak_planks" },
      ],
    );
    const world = new Map([
      ["1,64,2", "oak_planks"],
      ["2,64,2", "stone"],
    ]);
    const undo = store.prepareUndo("localhost:25565:overworld", (change) => world.get(`${change.x},${change.y},${change.z}`));
    assert.equal(undo.available, true);
    assert.equal(undo.operations.length, 1);
    assert.equal(undo.operations[0].block, "grass_block");
    assert.equal(undo.conflicts.length, 1);
    const id = store.saveBlueprint({
      name: "Cottage",
      category: "homes",
      structure: "house",
      material: "oak_planks",
      size: "small",
      floors: 1,
      dimensions: { width: 9, depth: 7, height: 4 },
    });
    assert.equal(store.listBlueprints().length, 1);
    store.duplicateBlueprint(id);
    assert.equal(store.listBlueprints().length, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pairing derives the same session id for both devices and does not use the short code", () => {
  const desktop = generateKeyPairSync("x25519");
  const phone = generateKeyPairSync("x25519");
  const desktopPem = desktop.publicKey.export({ type: "spki", format: "pem" });
  const phonePem = phone.publicKey.export({ type: "spki", format: "pem" });
  const fromDesktop = deriveSessionId(desktop.privateKey, phonePem);
  const fromPhone = deriveSessionId(phone.privateKey, desktopPem);
  assert.equal(fromDesktop, fromPhone);
  assert.equal(fromDesktop.includes("ABCDEF"), false);
  assert.equal(fromDesktop.length, 32);
});
