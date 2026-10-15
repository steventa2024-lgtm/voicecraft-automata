/** Composable, deterministic architecture in local Minecraft coordinates. */
import { canonicalStates, transformStates } from "./block-state.js";
import { MAX_OPERATIONS } from "./limits.js";

export const PALETTES = {
  cottage: {
    wall: "oak_planks",
    beam: "stripped_spruce_log",
    base: "cobblestone",
    roof: "deepslate_tile_stairs",
    ridge: "deepslate_tile_slab",
    wood: "spruce",
    trim: "stone_bricks",
  },
  rustic: {
    wall: "oak_planks",
    beam: "oak_log",
    base: "mossy_cobblestone",
    roof: "spruce_stairs",
    ridge: "spruce_slab",
    wood: "oak",
    trim: "cobblestone",
  },
  medieval: {
    wall: "stone_bricks",
    beam: "dark_oak_log",
    base: "cobblestone",
    roof: "dark_oak_stairs",
    ridge: "dark_oak_slab",
    wood: "dark_oak",
    trim: "chiseled_stone_bricks",
  },
  modern: {
    wall: "white_concrete",
    beam: "smooth_quartz",
    base: "stone_bricks",
    roof: "quartz_stairs",
    ridge: "quartz_slab",
    wood: "birch",
    trim: "polished_andesite",
  },
  fantasy: {
    wall: "calcite",
    beam: "stripped_dark_oak_log",
    base: "mossy_stone_bricks",
    roof: "deepslate_tile_stairs",
    ridge: "deepslate_tile_slab",
    wood: "dark_oak",
    trim: "amethyst_block",
  },
};
export const stair = (facing, half = "bottom", shape = "straight") => ({
  facing,
  half,
  shape,
  waterlogged: "false",
});
export const slab = (type = "bottom") => ({ type, waterlogged: "false" });
const directions = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
export function architect() {
  const cells = new Map();
  const put = (x, y, z, block, states) => {
    if (![x, y, z].every(Number.isInteger))
      throw new Error("Architecture coordinates must be integers.");
    const properties = canonicalStates(block, states);
    cells.set(`${x},${y},${z}`, {
      x,
      y,
      z,
      block,
      ...(Object.keys(properties).length ? { states: properties } : {}),
    });
    if (cells.size > MAX_OPERATIONS)
      throw new Error("Architecture exceeds the safe operation budget.");
  };
  const box = (x, y, z, w, h, d, block, states) => {
    for (let yy = y; yy < y + h; yy++)
      for (let zz = z; zz < z + d; zz++)
        for (let xx = x; xx < x + w; xx++) put(xx, yy, zz, block, states);
  };
  const at = (x, y, z) => cells.get(`${x},${y},${z}`);
  const finish = () => {
    // Explicit connections make panes and railings match the final neighbouring cells.
    for (const b of cells.values()) {
      if (!/_fence$|_pane$|_wall$|^iron_bars$/.test(b.block)) continue;
      const states = { waterlogged: "false" };
      for (const [dir, [dx, dz]] of Object.entries(directions)) {
        const other = at(b.x + dx, b.y, b.z + dz);
        states[dir] = String(
          !!other &&
            other.block !== "air" &&
            !/lantern|torch|leaves|slab|stairs|door/.test(other.block),
        );
      }
      if (b.block.endsWith("_wall")) {
        const straight =
          (states.north === "true" &&
            states.south === "true" &&
            states.east === "false" &&
            states.west === "false") ||
          (states.east === "true" &&
            states.west === "true" &&
            states.north === "false" &&
            states.south === "false");
        states.up = String(!straight || !!at(b.x, b.y + 1, b.z));
        for (const dir of Object.keys(directions))
          states[dir] = states[dir] === "true" ? "low" : "none";
      }
      b.states = canonicalStates(b.block, states);
    }
    // Supports and full blocks first; gravity, doors, panes and decorations last.
    const phase = (b) =>
      b.block === "air"
        ? 0
        : /door|ladder|lantern|torch|pane|fence|rail|carpet|flower|wheat/.test(b.block)
          ? 2
          : 1;
    return [...cells.values()].sort(
      (a, b) => phase(a) - phase(b) || a.y - b.y || a.z - b.z || a.x - b.x,
    );
  };
  return { put, box, at, finish };
}
export function foundation(k, x, y, z, w, d, p) {
  k.box(x, y - 1, z, w, 2, d, p.base);
  k.box(x + 1, y, z + 1, w - 2, 1, d - 2, `${p.wood}_planks`);
}
export function windowBay(k, x, y, z, facing, p, width = 2) {
  const horizontal = facing === "north" || facing === "south";
  for (let i = -1; i <= width; i++) {
    const xx = x + (horizontal ? i : 0),
      zz = z + (horizontal ? 0 : i);
    k.put(
      xx,
      y - 1,
      zz,
      p.beam,
      p.beam.includes("log") ? { axis: horizontal ? "x" : "z" } : undefined,
    );
    k.put(
      xx,
      y + 2,
      zz,
      p.beam,
      p.beam.includes("log") ? { axis: horizontal ? "x" : "z" } : undefined,
    );
    for (let j = 0; j < 2; j++)
      k.put(
        xx,
        y + j,
        zz,
        i === -1 || i === width ? p.beam : "glass_pane",
        (i === -1 || i === width) && p.beam.includes("log") ? { axis: "y" } : undefined,
      );
  }
  const [dx, dz] = directions[facing];
  for (let i = 0; i < width; i++)
    k.put(
      x + (horizontal ? i : 0) + dx,
      y - 1,
      z + (horizontal ? 0 : i) + dz,
      `${p.wood}_trapdoor`,
      { facing, half: "top", open: "false", powered: "false", waterlogged: "false" },
    );
}
export function doorway(k, x, y, z, facing, p, double = false) {
  const side = facing === "east" || facing === "west";
  const put = (a, b, id, states) =>
    k.put(x + (side ? 0 : a), y + b, z + (side ? a : 0), id, states);
  for (let i = 0; i < (double ? 2 : 1); i++)
    for (let h = 0; h < 2; h++)
      put(i, h, "" + p.wood + "_door", {
        facing,
        half: h ? "upper" : "lower",
        hinge: i ? "right" : "left",
        open: "false",
        powered: "false",
      });
  for (const a of [-1, double ? 2 : 1])
    for (let h = 0; h < 2; h++)
      put(a, h, p.beam, p.beam.includes("log") ? { axis: "y" } : undefined);
  for (let a = -1; a <= (double ? 2 : 1); a++)
    put(a, 2, p.beam, p.beam.includes("log") ? { axis: side ? "z" : "x" } : undefined);
}
export function room(k, x, y, z, w, d, h, p, { glass = false, entry = true, windows = true } = {}) {
  foundation(k, x, y, z, w, d, p);
  k.box(x, y + 1, z, w, h, d, "air");
  for (let yy = y + 1; yy <= y + h; yy++) {
    k.box(x, yy, z, w, 1, 1, p.wall);
    k.box(x, yy, z + d - 1, w, 1, 1, p.wall);
    k.box(x, yy, z, 1, 1, d, p.wall);
    k.box(x + w - 1, yy, z, 1, 1, d, p.wall);
  }
  for (const xx of [x, x + w - 1])
    for (const zz of [z, z + d - 1])
      k.box(xx, y + 1, zz, 1, h, 1, p.beam, p.beam.includes("log") ? { axis: "y" } : undefined);
  for (let xx = x + 5; xx < x + w - 2; xx += 5)
    for (const zz of [z, z + d - 1])
      k.box(xx, y + 1, zz, 1, h, 1, p.beam, p.beam.includes("log") ? { axis: "y" } : undefined);
  for (let zz = z + 5; zz < z + d - 2; zz += 5)
    for (const xx of [x, x + w - 1])
      k.box(xx, y + 1, zz, 1, h, 1, p.beam, p.beam.includes("log") ? { axis: "y" } : undefined);
  k.box(x, y + h, z, w, 1, 1, p.beam, p.beam.includes("log") ? { axis: "x" } : undefined);
  k.box(x, y + h, z + d - 1, w, 1, 1, p.beam, p.beam.includes("log") ? { axis: "x" } : undefined);
  if (windows && !glass && w >= 7 && d >= 7) {
    windowBay(k, x + 2, y + 2, z + d - 1, "south", p);
    if (w >= 9) {
      windowBay(k, x + 2, y + 2, z, "north", p, 1);
      windowBay(k, x + w - 3, y + 2, z, "north", p, 1);
    }
    windowBay(k, x, y + 2, z + 2, "west", p);
    windowBay(k, x + w - 1, y + 2, z + d - 4, "east", p);
    if (d >= 13) {
      windowBay(k, x, y + 2, z + d - 4, "west", p);
      windowBay(k, x + w - 1, y + 2, z + 2, "east", p);
    }
  }
  if (entry) doorway(k, x + Math.floor(w / 2), y + 1, z, "north", p);
}
export function gableRoof(k, x, y, z, w, d, p, { dormer = false } = {}) {
  const rise = Math.floor((w - 1) / 2);
  for (let i = 0; i < w; i++) {
    const r = Math.min(i, w - 1 - i),
      yy = y + r;
    for (let zz = z - 1; zz <= z + d; zz++) {
      if (i === rise && w % 2) k.put(x + i, yy, zz, p.ridge, slab());
      else k.put(x + i, yy, zz, p.roof, stair(i < w / 2 ? "east" : "west"));
    }
    // Gable triangles enclose the usable attic, while the roof remains hollow.
    if (r > 0) for (const zz of [z, z + d - 1]) k.box(x + i, y, zz, 1, r, 1, p.wall);
  }
  for (const xx of [x - 1, x + w])
    for (let zz = z - 1; zz <= z + d; zz++)
      k.put(xx, y - 1, zz, p.roof, stair(xx < x ? "east" : "west"));
  for (const zz of [z, z + d - 1]) {
    const cx = x + Math.floor(w / 2);
    for (let yy = y; yy < y + rise; yy++)
      k.put(cx, yy, zz, p.beam, p.beam.includes("log") ? { axis: "y" } : undefined);
    if (w >= 7) for (const xx of [cx - 1, cx + 1]) k.put(xx, y + 1, zz, "glass_pane");
  }
  if (dormer && w >= 9 && d >= 8) {
    const dx = x + 1,
      dz = z + Math.floor(d / 2) - 1;
    k.box(dx, y + 1, dz, 3, 2, 3, p.wall);
    windowBay(k, dx, y + 1, dz + 1, "west", p, 1);
    // Small perpendicular gable, built in a rotated component frame.
    const rotated = {
      put: (a, b, c, id, s) =>
        k.put(
          dx + c,
          b,
          dz + a,
          id,
          transformStates(s, (x, z) => [z, x], true),
        ),
      box: (a, b, c, ww, hh, dd, id, s) =>
        k.box(
          dx + c,
          b,
          dz + a,
          dd,
          hh,
          ww,
          id,
          transformStates(s, (x, z) => [z, x], true),
        ),
    };
    gableRoof(rotated, 0, y + 3, 0, 3, 3, p);
  }
}
export function hipRoof(k, x, y, z, w, d, p) {
  const levels = Math.ceil(Math.min(w, d) / 2);
  for (let r = 0; r < levels; r++) {
    const x0 = x + r,
      x1 = x + w - 1 - r,
      z0 = z + r,
      z1 = z + d - 1 - r;
    if (x1 <= x0 || z1 <= z0) {
      k.box(x0, y + r, z0, Math.max(1, x1 - x0 + 1), 1, Math.max(1, z1 - z0 + 1), p.ridge, slab());
      break;
    }
    for (let xx = x0; xx <= x1; xx++)
      for (const zz of [z0, z1])
        k.put(
          xx,
          y + r,
          zz,
          p.roof,
          stair(
            zz === z0 ? "south" : "north",
            "bottom",
            xx === x0
              ? zz === z0
                ? "outer_left"
                : "outer_right"
              : xx === x1
                ? zz === z0
                  ? "outer_right"
                  : "outer_left"
                : "straight",
          ),
        );
    for (let zz = z0 + 1; zz < z1; zz++)
      for (const xx of [x0, x1]) k.put(xx, y + r, zz, p.roof, stair(xx === x0 ? "east" : "west"));
  }
}
export function deck(k, x, y, z, w, d, p, { rails = true, gateX = x + Math.floor(w / 2) } = {}) {
  k.box(x, y, z, w, 1, d, `${p.wood}_planks`);
  for (const xx of [x, x + w - 1])
    for (const zz of [z, z + d - 1])
      k.box(
        xx,
        Math.min(0, y),
        zz,
        1,
        Math.max(1, y + 1),
        1,
        p.beam,
        p.beam.includes("log") ? { axis: "y" } : undefined,
      );
  if (rails) {
    for (let xx = x; xx < x + w; xx++) if (xx !== gateX) k.put(xx, y + 1, z, `${p.wood}_fence`);
    for (let zz = z + 1; zz < z + d; zz++)
      for (const xx of [x, x + w - 1]) k.put(xx, y + 1, zz, `${p.wood}_fence`);
  }
}
export function stairway(k, x, y, z, width, rise, facing, p) {
  const [dx, dz] = directions[facing];
  for (let i = 0; i < rise; i++)
    for (let a = 0; a < width; a++) {
      const xx = x + dx * i + (dx ? 0 : a),
        zz = z + dz * i + (dz ? 0 : a);
      k.box(xx, y, zz, 1, i + 1, 1, p.base);
      k.put(xx, y + i + 1, zz, `${p.wood}_stairs`, stair(facing));
      // A traversable two-block-high passage above every tread.
      k.box(xx, y + i + 2, zz, 1, 3, 1, "air");
    }
}
export function chimney(k, x, y, z, height, p) {
  k.box(x, y, z, 2, height, 2, "bricks");
  k.put(x, y, z - 1, "campfire", {
    facing: "north",
    lit: "true",
    signal_fire: "false",
    waterlogged: "false",
  });
  k.box(x - 1, y + height - 1, z - 1, 4, 1, 4, "brick_slab", slab());
  k.put(x, y + height, z, "campfire", {
    facing: "north",
    lit: "true",
    signal_fire: "false",
    waterlogged: "false",
  });
}
export function interior(k, x, y, z, w, d, p) {
  // Usable table, chairs and work area; no protected containers are generated.
  k.put(x + 1, y + 1, z + d - 2, "crafting_table");
  k.put(x + w - 2, y + 1, z + d - 2, "bookshelf");
  k.put(x + 2, y + 1, z + 2, `${p.wood}_fence`);
  k.put(x + 2, y + 2, z + 2, `${p.wood}_pressure_plate`, { powered: "false" });
  k.put(x + 3, y + 1, z + 2, `${p.wood}_stairs`, stair("west"));
  k.put(x + w - 2, y + 1, z + 1, "lantern", { hanging: "false", waterlogged: "false" });
}
export function tree(k, x, y, z, height = 9, radius = 3) {
  k.box(x, y, z, 1, height, 1, "oak_log", { axis: "y" });
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    k.put(x + dx, y + height - 3, z + dz, "oak_log", { axis: dx ? "x" : "z" });
  }
  for (let yy = -2; yy <= 2; yy++)
    for (let xx = -radius; xx <= radius; xx++)
      for (let zz = -radius; zz <= radius; zz++) {
        if (xx * xx + zz * zz + yy * yy * 2 <= radius * radius + 1 && (xx || zz || yy > 0))
          k.put(x + xx, y + height + yy, z + zz, "oak_leaves", {
            persistent: "true",
            waterlogged: "false",
          });
      }
}
export function garden(k, x, y, z, w, d, p) {
  // Small supported beds and paths, without synthesising the player's surrounding world.
  for (let xx = x; xx < x + w; xx++)
    for (let zz = z; zz < z + d; zz++) {
      k.put(xx, y - 1, zz, "dirt");
      k.put(xx, y, zz, (xx + zz) % 5 === 0 ? "mossy_cobblestone" : "grass_block");
      if ((xx === x || xx === x + w - 1) && zz % 3 === 0)
        k.put(xx, y + 1, zz, "oak_leaves", { persistent: "true", waterlogged: "false" });
    }
  const cx = x + Math.floor(w / 2);
  k.box(cx, y, z, 2, 1, d, "gravel");
  for (const xx of [x, x + w - 1]) {
    k.put(xx, y + 1, z, p.base);
    k.put(xx, y + 2, z, "lantern", { hanging: "false", waterlogged: "false" });
  }
}
export function tower(k, cx, y, cz, r, h, p, { roof = true } = {}) {
  for (let yy = 0; yy <= h; yy++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const distance = Math.hypot(dx, dz);
        if (distance > r + 0.25) continue;
        const wall = distance > r - 1.1;
        k.put(cx + dx, y + yy, cz + dz, yy === 0 || yy === h || wall ? p.wall : "air");
        if (wall && yy % 5 === 3 && (dx === 0 || dz === 0))
          k.put(cx + dx, y + yy, cz + dz, "glass_pane");
      }
  for (let yy = 1; yy < h; yy++)
    k.put(cx, y + yy, cz + r - 1, "ladder", { facing: "north", waterlogged: "false" });
  k.put(cx, y + h, cz + r - 1, "air");
  if (roof) hipRoof(k, cx - r - 1, y + h + 1, cz - r - 1, r * 2 + 3, r * 2 + 3, p);
  else
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        if (Math.hypot(dx, dz) > r - 1.1 && Math.hypot(dx, dz) <= r + 0.25 && (dx + dz) % 2 === 0)
          k.put(cx + dx, y + h + 1, cz + dz, p.trim);
  doorway(k, cx, y + 1, cz - r, "north", p);
}
