/**
 * Procedural building routines.
 *
 * Each generator returns a list of {x, y, z, block} placements in *local*
 * coordinates; runBuild translates them to world space in front of the bot
 * and places them one at a time via the Mineflayer creative API.
 */
import { Vec3 } from "vec3";
import { placeBlocks } from "./placer.js";

const TRIM = {
  stone_bricks: "chiseled_stone_bricks",
  oak_planks: "oak_log",
  quartz_block: "chiseled_quartz_block",
  deepslate_tiles: "polished_deepslate",
  sandstone: "chiseled_sandstone",
  bricks: "bricks",
  glass: "glass",
};

const ROOF = {
  stone_bricks: "stone_brick_stairs",
  oak_planks: "oak_stairs",
  quartz_block: "quartz_stairs",
  deepslate_tiles: "deepslate_tile_stairs",
  sandstone: "sandstone_stairs",
  bricks: "brick_stairs",
  glass: "glass",
};

const push = (out, x, y, z, block) => out.push({ x, y, z, block });

/* --------------------------------------------------------------- shapes */

function box(out, x0, y0, z0, w, h, d, block, { hollow = true, skipTop = false } = {}) {
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < h; y += 1) {
      for (let z = 0; z < d; z += 1) {
        const shell =
          x === 0 || x === w - 1 || z === 0 || z === d - 1 || y === 0 || (!skipTop && y === h - 1);
        if (hollow && !shell) continue;
        push(out, x0 + x, y0 + y, z0 + z, block);
      }
    }
  }
}

function windows(out, w, d, floorY, block = "glass_pane") {
  for (let x = 2; x < w - 2; x += 3) {
    push(out, x, floorY + 2, 0, block);
    push(out, x, floorY + 2, d - 1, block);
  }
  for (let z = 2; z < d - 2; z += 3) {
    push(out, 0, floorY + 2, z, block);
    push(out, w - 1, floorY + 2, z, block);
  }
}

function gabledRoof(out, w, d, baseY, block) {
  const layers = Math.ceil(Math.min(w, d) / 2);
  for (let i = 0; i < layers; i += 1) {
    const x0 = i;
    const z0 = i;
    const x1 = w - 1 - i;
    const z1 = d - 1 - i;
    if (x1 < x0 || z1 < z0) break;
    for (let x = x0; x <= x1; x += 1) {
      push(out, x, baseY + i, z0, block);
      push(out, x, baseY + i, z1, block);
    }
    for (let z = z0; z <= z1; z += 1) {
      push(out, x0, baseY + i, z, block);
      push(out, x1, baseY + i, z, block);
    }
  }
}

/* ----------------------------------------------------------- generators */

function genHouse(i) {
  const { width: w, depth: d } = i.dimensions;
  const h = 5;
  const out = [];
  box(out, 0, 0, 0, w, h, d, i.material, { hollow: true, skipTop: true });
  windows(out, w, d, 0);
  // door
  const doorX = Math.floor(w / 2);
  push(out, doorX, 1, 0, "air");
  push(out, doorX, 2, 0, "air");
  gabledRoof(out, w, d, h, ROOF[i.material] || "oak_stairs");
  push(out, doorX, 3, 1, "lantern");
  return out;
}

function genMansion(i) {
  const { width: w, depth: d } = i.dimensions;
  const perFloor = 5;
  const out = [];
  // plinth
  box(out, -1, 0, -1, w + 2, 1, d + 2, TRIM[i.material] || i.material, { hollow: false });

  for (let f = 0; f < i.floors; f += 1) {
    const y = 1 + f * perFloor;
    box(out, 0, y, 0, w, perFloor, d, i.material, { hollow: true, skipTop: true });
    windows(out, w, d, y);
    // corner pillars
    for (const [px, pz] of [
      [0, 0],
      [0, d - 1],
      [w - 1, 0],
      [w - 1, d - 1],
    ]) {
      for (let k = 0; k < perFloor; k += 1) push(out, px, y + k, pz, TRIM[i.material] || i.material);
    }
    // floor slab for upper storeys
    if (f > 0) {
      for (let x = 1; x < w - 1; x += 1)
        for (let z = 1; z < d - 1; z += 1) push(out, x, y, z, i.material);
    }
  }

  const topY = 1 + i.floors * perFloor;
  gabledRoof(out, w, d, topY, ROOF[i.material] || "stone_brick_stairs");

  // grand entrance
  const cx = Math.floor(w / 2);
  for (const dx of [-1, 0, 1]) {
    push(out, cx + dx, 1, 0, "air");
    push(out, cx + dx, 2, 0, "air");
    push(out, cx + dx, 3, 0, "air");
  }
  push(out, cx - 2, 3, 0, "lantern");
  push(out, cx + 2, 3, 0, "lantern");
  return out;
}

function genTower(i) {
  const { width: w, depth: d, height: h } = i.dimensions;
  const out = [];
  box(out, 0, 0, 0, w, h, d, i.material, { hollow: true, skipTop: true });
  for (let y = 2; y < h; y += 4) windows(out, w, d, y - 2);
  // battlements
  for (let x = 0; x < w; x += 2) {
    push(out, x, h, 0, TRIM[i.material] || i.material);
    push(out, x, h, d - 1, TRIM[i.material] || i.material);
  }
  for (let z = 0; z < d; z += 2) {
    push(out, 0, h, z, TRIM[i.material] || i.material);
    push(out, w - 1, h, z, TRIM[i.material] || i.material);
  }
  // spiral staircase
  const ring = [
    [1, 1],
    [w - 2, 1],
    [w - 2, d - 2],
    [1, d - 2],
  ];
  for (let y = 1; y < h; y += 1) {
    const [sx, sz] = ring[y % ring.length];
    push(out, sx, y, sz, i.material);
  }
  push(out, Math.floor(w / 2), 1, 0, "air");
  push(out, Math.floor(w / 2), 2, 0, "air");
  return out;
}

function genCastle(i) {
  const { width: w, depth: d } = i.dimensions;
  const wallH = 8;
  const out = [];
  // curtain wall
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < wallH; y += 1) {
      push(out, x, y, 0, i.material);
      push(out, x, y, d - 1, i.material);
    }
    if (x % 2 === 0) {
      push(out, x, wallH, 0, i.material);
      push(out, x, wallH, d - 1, i.material);
    }
  }
  for (let z = 0; z < d; z += 1) {
    for (let y = 0; y < wallH; y += 1) {
      push(out, 0, y, z, i.material);
      push(out, w - 1, y, z, i.material);
    }
    if (z % 2 === 0) {
      push(out, 0, wallH, z, i.material);
      push(out, w - 1, wallH, z, i.material);
    }
  }
  // corner towers
  const towerSpec = { ...i, dimensions: { width: 5, depth: 5, height: wallH + 4 } };
  for (const [ox, oz] of [
    [0, 0],
    [w - 5, 0],
    [0, d - 5],
    [w - 5, d - 5],
  ]) {
    for (const p of genTower(towerSpec)) push(out, p.x + ox, p.y, p.z + oz, p.block);
  }
  // gate
  const gx = Math.floor(w / 2);
  for (const dx of [-1, 0, 1])
    for (let y = 1; y <= 3; y += 1) push(out, gx + dx, y, 0, "air");
  return out;
}

function genPyramid(i) {
  const { width: w } = i.dimensions;
  const out = [];
  const layers = Math.ceil(w / 2);
  for (let y = 0; y < layers; y += 1) {
    for (let x = y; x < w - y; x += 1) {
      for (let z = y; z < w - y; z += 1) {
        const edge = x === y || x === w - 1 - y || z === y || z === w - 1 - y;
        if (edge) push(out, x, y, z, i.material);
      }
    }
  }
  return out;
}

function genBridge(i) {
  const { width: w, depth: d } = i.dimensions;
  const out = [];
  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) push(out, x, 0, z, i.material);
    if (x % 4 === 0) {
      for (let y = 1; y <= 2; y += 1) {
        push(out, x, y, 0, TRIM[i.material] || i.material);
        push(out, x, y, d - 1, TRIM[i.material] || i.material);
      }
      push(out, x, 3, 0, "lantern");
    }
    push(out, x, 1, 0, "oak_fence");
    push(out, x, 1, d - 1, "oak_fence");
  }
  return out;
}

function genWall(i) {
  const { width: w, height: h } = i.dimensions;
  const out = [];
  for (let x = 0; x < w; x += 1)
    for (let y = 0; y < h; y += 1) push(out, x, y, 0, i.material);
  for (let x = 0; x < w; x += 2) push(out, x, h, 0, i.material);
  return out;
}

function genFarm(i) {
  const { width: w, depth: d } = i.dimensions;
  const out = [];
  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) {
      const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
      if (edge) {
        push(out, x, 0, z, "oak_log");
        push(out, x, 1, z, "oak_fence");
      } else if (z % 3 === 0) {
        push(out, x, 0, z, "water");
      } else {
        push(out, x, 0, z, "farmland");
        push(out, x, 1, z, "wheat");
      }
    }
  }
  return out;
}

function genGarden(i) {
  const { width: w, depth: d } = i.dimensions;
  const out = [];
  const cx = Math.floor(w / 2);
  const cz = Math.floor(d / 2);
  const flowers = ["poppy", "dandelion", "blue_orchid", "allium", "cornflower", "oxeye_daisy"];

  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) {
      const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
      const path = x === cx || z === cz;
      if (edge) {
        push(out, x, 0, z, "cobblestone");
        push(out, x, 1, z, "oak_fence");
        continue;
      }
      if (path) {
        push(out, x, 0, z, "gravel");
        continue;
      }
      push(out, x, 0, z, "grass_block");
      if ((x + z) % 2 === 0) {
        push(out, x, 1, z, flowers[(x * 7 + z * 3) % flowers.length]);
      } else if ((x * z) % 11 === 0) {
        push(out, x, 1, z, "oak_leaves");
      }
    }
  }

  // central pond + lantern posts on the corners of the crossing paths
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 0],
  ]) {
    push(out, cx + dx, 0, cz + dz, "water");
  }
  for (const [dx, dz] of [
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ]) {
    push(out, cx + dx, 1, cz + dz, "oak_fence");
    push(out, cx + dx, 2, cz + dz, "lantern");
  }

  // small trees in the quadrants
  for (const [tx, tz] of [
    [2, 2],
    [w - 3, 2],
    [2, d - 3],
    [w - 3, d - 3],
  ]) {
    for (let y = 1; y <= 4; y += 1) push(out, tx, y, tz, "oak_log");
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;
        push(out, tx + dx, 4, tz + dz, "oak_leaves");
        if (Math.abs(dx) + Math.abs(dz) <= 1) push(out, tx + dx, 5, tz + dz, "oak_leaves");
      }
    }
  }
  return out;
}

function genFountain(i) {
  const { width: w } = i.dimensions;
  const r = Math.max(3, Math.floor(w / 2));
  const cx = r;
  const cz = r;
  const out = [];
  const trim = TRIM[i.material] || i.material;

  for (let x = 0; x <= r * 2; x += 1) {
    for (let z = 0; z <= r * 2; z += 1) {
      const dist = Math.hypot(x - cx, z - cz);
      if (dist > r) continue;
      if (dist > r - 1) {
        push(out, x, 0, z, trim);
        push(out, x, 1, z, i.material);
      } else {
        push(out, x, 0, z, i.material);
        push(out, x, 1, z, "water");
      }
    }
  }
  for (let y = 1; y <= 3; y += 1) push(out, cx, y, cz, i.material);
  push(out, cx, 4, cz, "water");
  for (const [dx, dz] of [
    [-r, -r],
    [r, -r],
    [-r, r],
    [r, r],
  ]) {
    push(out, cx + Math.round(dx * 0.7), 2, cz + Math.round(dz * 0.7), "lantern");
  }
  return out;
}

function genFortress(i) {
  const { width: w, depth: d } = i.dimensions;
  const wallH = Math.max(8, Math.round(i.dimensions.height / 1.2));
  const trim = TRIM[i.material] || i.material;
  const out = [];
  // moat ring
  for (let x = -2; x < w + 2; x += 1) {
    for (let z = -2; z < d + 2; z += 1) {
      const outer = x < 0 || z < 0 || x >= w || z >= d;
      if (outer) push(out, x, 0, z, "water");
    }
  }
  // thick curtain wall (2 blocks deep) with walkway + crenellations
  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) {
      const ring = x <= 1 || z <= 1 || x >= w - 2 || z >= d - 2;
      if (!ring) continue;
      for (let y = 0; y < wallH; y += 1) push(out, x, y, z, i.material);
      push(out, x, wallH, z, trim);
      const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
      if (edge && (x + z) % 2 === 0) push(out, x, wallH + 1, z, i.material);
    }
  }
  // corner bastions
  const bastion = { ...i, dimensions: { width: 7, depth: 7, height: wallH + 6 } };
  for (const [ox, oz] of [
    [-1, -1],
    [w - 6, -1],
    [-1, d - 6],
    [w - 6, d - 6],
  ]) {
    for (const p of genWatchtower(bastion)) push(out, p.x + ox, p.y, p.z + oz, p.block);
  }
  // gatehouse
  const gx = Math.floor(w / 2);
  for (const dx of [-1, 0, 1]) {
    for (let y = 1; y <= 4; y += 1) {
      push(out, gx + dx, y, 0, "air");
      push(out, gx + dx, y, 1, "air");
    }
  }
  push(out, gx - 2, wallH + 1, 0, "lantern");
  push(out, gx + 2, wallH + 1, 0, "lantern");
  // inner keep
  const keepW = Math.max(7, Math.floor(w / 3));
  const keepD = Math.max(7, Math.floor(d / 3));
  const kx = Math.floor((w - keepW) / 2);
  const kz = Math.floor((d - keepD) / 2);
  box(out, kx, 0, kz, keepW, 7, keepD, i.material, { hollow: true, skipTop: true });
  gabledRoof(out, keepW, keepD, 7, ROOF[i.material] || "stone_brick_stairs");
  for (let x = 0; x < keepW; x += 1)
    for (let z = 0; z < keepD; z += 1)
      if (x !== 0 && z !== 0 && x !== keepW - 1 && z !== keepD - 1) continue;
  push(out, kx + Math.floor(keepW / 2), 1, kz, "air");
  push(out, kx + Math.floor(keepW / 2), 2, kz, "air");
  // courtyard torches
  for (let x = 3; x < w - 3; x += 6)
    for (let z = 3; z < d - 3; z += 6) push(out, x, 1, z, "lantern");
  return out;
}

function genWatchtower(i) {
  const w = Math.max(5, i.dimensions.width);
  const d = Math.max(5, i.dimensions.depth);
  const h = Math.max(12, i.dimensions.height);
  const trim = TRIM[i.material] || i.material;
  const stairs = ROOF[i.material] || "stone_brick_stairs";
  const out = [];
  // solid footing
  box(out, -1, 0, -1, w + 2, 1, d + 2, trim, { hollow: false });
  // shaft
  box(out, 0, 1, 0, w, h, d, i.material, { hollow: true, skipTop: true });
  // ladder up the inside north wall
  for (let y = 1; y < h; y += 1) push(out, 1, y, 1, "ladder");
  // slit windows every 3 blocks
  for (let y = 4; y < h - 2; y += 3) {
    push(out, Math.floor(w / 2), y, 0, "glass_pane");
    push(out, Math.floor(w / 2), y, d - 1, "glass_pane");
    push(out, 0, y, Math.floor(d / 2), "glass_pane");
    push(out, w - 1, y, Math.floor(d / 2), "glass_pane");
  }
  // overhanging lookout deck
  const deckY = h;
  for (let x = -1; x <= w; x += 1) {
    for (let z = -1; z <= d; z += 1) {
      push(out, x, deckY, z, i.material);
      const rim = x === -1 || z === -1 || x === w || z === d;
      if (rim) {
        push(out, x, deckY + 1, z, "oak_fence");
        if ((x + z) % 2 === 0) push(out, x, deckY + 2, z, trim);
      }
    }
  }
  // roof cap + beacon light
  gabledRoof(out, w + 2, d + 2, deckY + 3, stairs);
  const cx = Math.floor(w / 2);
  const cz = Math.floor(d / 2);
  push(out, cx, deckY + 1, cz, "glowstone");
  push(out, cx, deckY + 2, cz, "lantern");
  // door
  push(out, cx, 1, 0, "air");
  push(out, cx, 2, 0, "air");
  return out;
}

const GENERATORS = {
  house: genHouse,
  mansion: genMansion,
  tower: genTower,
  castle: genCastle,
  pyramid: genPyramid,
  bridge: genBridge,
  wall: genWall,
  farm: genFarm,
  garden: genGarden,
  fountain: genFountain,
  fortress: genFortress,
  watchtower: genWatchtower,
};


export function planBuild(instruction) {
  const gen = GENERATORS[instruction.structure] || genHouse;
  return gen(instruction);
}

/* -------------------------------------------------------------- runtime */

function originFor(bot, instruction) {
  const p = bot.entity.position.floored();
  const yaw = bot.entity.yaw;
  const fx = -Math.round(Math.sin(yaw));
  const fz = Math.round(Math.cos(yaw));
  const off = instruction.offset?.z ?? 6;
  const { width, depth } = instruction.dimensions;
  return new Vec3(
    p.x + fx * off - Math.floor(width / 2),
    p.y + (instruction.offset?.y ?? 0),
    p.z + fz * off - Math.floor(depth / 2),
  );
}

/**
 * Ground the build: drop the origin to the first solid block under the bot so
 * structures sit on the terrain instead of floating.
 */
function groundY(bot, origin, width, depth) {
  let best = origin.y;
  let found = false;
  for (const [dx, dz] of [
    [0, 0],
    [width - 1, 0],
    [0, depth - 1],
    [width - 1, depth - 1],
  ]) {
    for (let y = origin.y + 4; y > origin.y - 12; y -= 1) {
      const block = bot.blockAt(new Vec3(origin.x + dx, y, origin.z + dz));
      if (block && block.boundingBox === "block" && block.name !== "air") {
        best = found ? Math.min(best, y + 1) : y + 1;
        found = true;
        break;
      }
    }
  }
  return found ? best : origin.y;
}

export async function runBuild(bot, instruction, job, onProgress, mode) {
  const blocks = planBuild(instruction);
  const base = originFor(bot, instruction);
  const { width, depth } = instruction.dimensions;
  const origin = new Vec3(base.x, groundY(bot, base, width, depth), base.z);
  const result = await placeBlocks(bot, blocks, origin, job, onProgress, mode);
  return { ...result, origin, total: blocks.length };
}

export async function clearArea(bot, instruction, job, onProgress, mode) {
  const { width, depth } = instruction.dimensions;
  const height = 24;
  const base = originFor(bot, instruction);
  const origin = new Vec3(base.x, groundY(bot, base, width, depth), base.z);
  const blocks = [];
  for (let x = 0; x < width; x += 1)
    for (let z = 0; z < depth; z += 1)
      for (let y = 0; y < height; y += 1) blocks.push({ x, y, z, block: "air" });
  const result = await placeBlocks(bot, blocks, origin, job, onProgress, mode);
  return { ...result, origin, total: blocks.length };
}
