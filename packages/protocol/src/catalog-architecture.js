import {
  architect,
  PALETTES,
  room,
  foundation,
  gableRoof,
  hipRoof,
  deck,
  stairway,
  chimney,
  interior,
  tree,
  garden,
  tower,
  doorway,
  stair,
  slab,
} from "./architecture.js";

/** Distinct compositions; shared components describe architecture, never a generic reskinned cube. */
export const CATALOG_DEFAULTS = {
  "luxury-mansion": [29, 21],
  "suburban-house": [23, 15],
  duplex: [25, 13],
  "penthouse-tower": [17, 17],
  "royal-castle": [35, 33],
  gatehouse: [23, 11],
  "defensive-wall": [29, 7],
  citadel: [37, 35],
  "wizard-tower": [17, 17],
  "enchanted-library": [21, 15],
  "dragon-shrine": [25, 23],
  "floating-island": [25, 25],
  "elven-sanctuary": [23, 23],
  blacksmith: [17, 13],
  "market-hall": [27, 13],
  bakery: [15, 13],
  inn: [23, 15],
  "town-hall": [25, 19],
  "crop-farm": [23, 19],
  barn: [21, 15],
  greenhouse: [21, 15],
  windmill: [21, 21],
  "botanical-garden": [25, 25],
  "stone-arch-bridge": [29, 7],
  "suspension-bridge": [31, 5],
  "mine-entrance": [19, 13],
  "mountain-watchtower": [13, 13],
  lighthouse: [15, 15],
  "desert-pyramid": [27, 27],
  "greek-temple": [23, 17],
  "ancient-ruins": [23, 21],
  "mountain-shrine": [21, 23],
  "memorial-plaza": [23, 23],
  warehouse: [27, 19],
  workshop: [21, 15],
  sawmill: [25, 17],
  "railway-depot": [29, 11],
  silos: [29, 15],
  "pvp-arena": [29, 25],
  stadium: [35, 29],
  "hedge-maze": [27, 25],
  "zen-garden": [23, 21],
  "fountain-plaza": [27, 27],
};
const palette = (o, style = "medieval") => ({
  ...PALETTES[style],
  wall: o.material,
  trim: o.accent,
});
const light = (k, x, y, z) => k.put(x, y, z, "lantern", { hanging: "false", waterlogged: "false" });
const leaves = (k, x, y, z) =>
  k.put(x, y, z, "oak_leaves", { persistent: "true", waterlogged: "false" });
function arch(k, x, y, z, width, height, p) {
  k.box(x, y, z, 2, height, 2, p.wall);
  k.box(x + width - 2, y, z, 2, height, 2, p.wall);
  k.box(x + 2, y + height - 1, z, width - 4, 1, 2, p.trim);
  k.put(x + 2, y + height - 2, z, "stone_brick_stairs", stair("east", "top"));
  k.put(x + width - 3, y + height - 2, z, "stone_brick_stairs", stair("west", "top"));
}
function court(k, w, d, p) {
  k.box(-1, -1, -1, w + 2, 2, d + 2, p.base);
  k.box(0, 0, 0, w, 1, d, p.trim);
}
function curtain(k, x, z, w, d, h, p) {
  for (const zz of [z, z + d - 2]) k.box(x, 1, zz, w, h, 2, p.wall);
  for (const xx of [x, x + w - 2]) k.box(xx, 1, z, 2, h, d, p.wall);
  for (let xx = x; xx < x + w; xx += 2)
    for (const zz of [z, z + d - 1]) k.put(xx, h + 1, zz, p.trim);
  for (let zz = z; zz < z + d; zz += 2)
    for (const xx of [x, x + w - 1]) k.put(xx, h + 1, zz, p.trim);
  k.box(x + Math.floor(w / 2) - 1, 1, z, 3, 4, 2, "air");
}
function colonnade(k, x, y, z, w, d, p) {
  foundation(k, x, y, z, w, d, p);
  for (let xx = x + 1; xx < x + w - 1; xx += 4)
    for (const zz of [z + 1, z + d - 2]) {
      k.box(xx, y + 1, zz, 1, 5, 1, "quartz_pillar", { axis: "y" });
      k.box(xx - 1, y + 6, zz - 1, 3, 1, 3, "quartz_slab", slab("top"));
    }
  gableRoof(k, x, y + 7, z, w, d, {
    ...p,
    wall: p.wall,
    roof: "quartz_stairs",
    ridge: "quartz_slab",
  });
}
function basin(k, x, y, z, w, d, p) {
  k.box(x, y - 1, z, w, 2, d, p.trim);
  k.box(x + 1, y, z + 1, w - 2, 1, d - 2, "water", { level: "0" });
}
function pavilion(k, x, y, z, w, d, p) {
  foundation(k, x, y, z, w, d, p);
  for (const xx of [x, x + w - 1])
    for (const zz of [z, z + d - 1])
      k.box(xx, y + 1, zz, 1, 5, 1, p.beam, p.beam.includes("log") ? { axis: "y" } : undefined);
  hipRoof(k, x - 1, y + 6, z - 1, w + 2, d + 2, p);
  light(k, x + Math.floor(w / 2), y + 1, z + Math.floor(d / 2));
}
const recipes = {
  "luxury-mansion"(k, o, p) {
    court(k, o.w, o.d, p);
    const w = o.w - 14;
    room(k, 7, 0, 2, w, o.d - 4, 5, p);
    room(k, 8, 6, 3, w - 2, o.d - 6, 4, p);
    for (const x of [0, o.w - 8]) {
      room(k, x, 0, 5, 8, o.d - 8, 4, p);
      hipRoof(k, x - 1, 5, 4, 10, o.d - 6, p);
    }
    hipRoof(k, 7, 11, 2, w, o.d - 4, p);
    colonnade(k, 9, 0, -3, w - 4, 5, p);
    stairway(k, 9, 0, 5, 2, 6, "south", p);
    interior(k, 7, 0, 2, w, o.d - 4, p);
    for (const x of [2, o.w - 5]) basin(k, x, 0, 0, 3, 4, p);
  },
  "suburban-house"(k, o, p) {
    garden(k, -2, -1, -4, o.w + 4, o.d + 7, p);
    const w = o.w - 8;
    room(k, 0, 0, 1, w, o.d - 2, 4, p);
    gableRoof(k, 0, 5, 1, w, o.d - 2, p, { dormer: true });
    room(k, w - 1, 0, 3, 9, o.d - 4, 3, p, { entry: false });
    hipRoof(k, w - 2, 4, 2, 11, o.d - 2, p);
    k.box(w + 1, 1, 3, 5, 3, 1, "air");
    k.box(w + 1, 0, -4, 5, 1, 8, "smooth_stone");
    deck(k, 2, 0, -2, 7, 3, p, { rails: false });
    interior(k, 0, 0, 1, w, o.d - 2, p);
    tree(k, 0, 0, o.d + 1, 9, 3);
  },
  duplex(k, o, p) {
    court(k, o.w, o.d, p);
    const w = Math.floor(o.w / 2);
    for (const x of [0, w]) {
      room(k, x, 0, 0, w, o.d, 4, p);
      room(k, x, 5, 1, w, o.d - 1, 4, p);
      k.box(x - 1, 10, 0, w + 2, 1, o.d + 1, "quartz_slab", slab("top"));
      stairway(k, x + 2, 0, 3, 2, 5, "south", p);
      interior(k, x, 0, 0, w, o.d, p);
      deck(k, x + 2, 5, -2, w - 4, 3, p);
    }
    k.box(w - 1, 0, 0, 1, 11, o.d, "stone_bricks");
  },
  "penthouse-tower"(k, o, p) {
    court(k, o.w, o.d, p);
    for (let level = 0; level < 4; level++) {
      const inset = level === 3 ? 2 : 0;
      room(
        k,
        inset,
        level * 5,
        inset,
        o.w - inset * 2,
        o.d - inset * 2,
        4,
        { ...p, wall: level === 3 ? "glass" : p.wall },
        { glass: level === 3 },
      );
      k.box(-1, level * 5 + 5, -1, o.w + 2, 1, o.d + 2, "smooth_quartz");
      if (level < 3) stairway(k, 2, level * 5, 3, 2, 5, "south", p);
    }
    deck(k, -2, 15, -3, o.w + 4, 3, p);
    interior(k, 2, 15, 2, o.w - 4, o.d - 4, p);
    k.box(3, 21, 3, o.w - 6, 1, o.d - 6, "glass");
  },
  "royal-castle"(k, o, p) {
    court(k, o.w, o.d, p);
    curtain(k, 2, 2, o.w - 4, o.d - 4, 8, p);
    for (const x of [4, o.w - 5]) for (const z of [4, o.d - 5]) tower(k, x, 0, z, 4, 15, p);
    room(k, 10, 0, 12, o.w - 20, o.d - 17, 6, p);
    room(k, 11, 7, 13, o.w - 22, o.d - 19, 5, p);
    gableRoof(k, 10, 13, 12, o.w - 20, o.d - 17, p);
    tower(k, Math.floor(o.w / 2), 0, o.d - 8, 3, 23, {
      ...p,
      roof: "deepslate_tile_stairs",
      ridge: "deepslate_tile_slab",
    });
    stairway(k, 7, 0, 8, 2, 8, "south", p);
    stairway(k, 12, 0, 14, 2, 7, "south", p);
    arch(k, Math.floor(o.w / 2) - 4, 1, 1, 9, 7, p);
  },
  gatehouse(k, o, p) {
    court(k, o.w, o.d, p);
    const c = Math.floor(o.w / 2);
    tower(k, 4, 0, Math.floor(o.d / 2), 4, 13, p);
    tower(k, o.w - 5, 0, Math.floor(o.d / 2), 4, 13, p);
    room(k, 7, 7, 2, o.w - 14, 7, 4, p, { entry: false, windows: false });
    gableRoof(k, 7, 12, 2, o.w - 14, 7, p);
    arch(k, c - 4, 1, 2, 9, 7, p);
    k.box(c - 2, 0, -3, 5, 1, o.d + 6, "stone_bricks");
    k.box(c - 2, 7, 4, 5, 1, 1, "iron_bars");
  },
  "defensive-wall"(k, o, p) {
    court(k, o.w, o.d, p);
    k.box(0, 1, 2, o.w, 8, 3, p.wall);
    for (let x = 0; x < o.w; x += 2) for (const z of [1, 5]) k.box(x, 8, z, 1, 2, 1, p.trim);
    for (let x = 1; x < o.w; x += 6) k.box(x, 0, 1, 2, 6, 1, "chiseled_stone_bricks");
    stairway(k, 1, 0, 5, 2, 8, "east", p);
    const c = Math.floor(o.w / 2);
    k.box(c - 1, 1, 2, 3, 4, 3, "air");
    arch(k, c - 3, 1, 1, 7, 6, p);
    for (const x of [0, o.w - 5]) tower(k, x + 2, 0, 3, 3, 11, p, { roof: false });
  },
  citadel(k, o, p) {
    court(k, o.w, o.d, p);
    curtain(k, 1, 1, o.w - 2, o.d - 2, 7, p);
    curtain(k, 8, 8, o.w - 16, o.d - 16, 11, p);
    for (const x of [4, o.w - 5])
      for (const z of [4, o.d - 5]) tower(k, x, 0, z, 3, 12, p, { roof: false });
    tower(k, Math.floor(o.w / 2), 0, Math.floor(o.d / 2) + 2, 5, 23, p);
    stairway(k, 5, 0, 8, 2, 7, "south", p);
    stairway(k, 10, 0, 12, 2, 11, "south", p);
    k.box(Math.floor(o.w / 2) - 1, 0, -2, 3, 1, 12, "polished_andesite");
  },
  "wizard-tower"(k, o, p) {
    court(k, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    tower(k, c, 0, z, 5, 17, p, { roof: false });
    tower(k, c + 1, 17, z, 4, 7, p);
    deck(k, c - 6, 14, z - 6, 13, 3, p);
    k.box(c, 25, z, 1, 5, 1, "amethyst_block");
    k.put(c, 30, z, "glowstone");
    for (let y = 4; y < 23; y += 5) k.put(c - 5, y, z, "amethyst_block");
  },
  "enchanted-library"(k, o, p) {
    court(k, o.w, o.d, p);
    room(k, 0, 0, 0, o.w, o.d, 5, p);
    room(k, 1, 6, 1, o.w - 2, o.d - 2, 4, p);
    gableRoof(k, 0, 11, 0, o.w, o.d, p, { dormer: true });
    for (const y of [1, 7])
      for (let x = 2; x < o.w - 2; x += 4) k.box(x, y, 4, 2, 3, o.d - 6, "bookshelf");
    k.box(3, 6, 4, o.w - 6, 1, o.d - 8, "air");
    stairway(k, 1, 0, 3, 1, 6, "south", p);
    for (let x = 3; x < o.w - 3; x += 4) light(k, x, 1, 2);
    tower(k, o.w - 3, 0, o.d - 3, 3, 15, p);
  },
  "dragon-shrine"(k, o, p) {
    court(k, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    for (let r = 0; r < 4; r++) k.box(c - 7 + r, r, z - 7 + r, 15 - r * 2, 1, 15 - r * 2, p.wall);
    for (let y = 4; y < 15; y++)
      k.box(c, y, z, 2, 1, 2, y % 3 ? "polished_blackstone" : "amethyst_block");
    // A stepped dragon silhouette: neck, head, horns, wings and tail.
    k.box(c - 1, 14, z - 2, 4, 3, 4, "polished_blackstone");
    k.box(c, 14, z - 4, 2, 2, 3, "polished_blackstone");
    for (const x of [c - 1, c + 2]) {
      k.put(x, 15, z - 3, "sea_lantern");
      k.box(x, 17, z, 1, 3, 1, "blackstone");
    }
    for (let n = 1; n < 9; n++)
      for (const sign of [-1, 1]) {
        k.box(
          c + sign * n,
          12 - Math.floor(n / 3),
          z + Math.floor(n / 2),
          1,
          2,
          2,
          "polished_blackstone",
        );
        for (let j = 0; j < Math.max(1, 6 - n); j++)
          k.put(c + sign * n, 11 - j, z + Math.floor(n / 2), "purple_concrete");
      }
    stairway(k, c - 1, 0, 0, 3, 4, "south", p);
  },
  "floating-island"(k, o, p) {
    const cx = Math.floor(o.w / 2),
      cz = Math.floor(o.d / 2),
      rx = cx,
      rz = cz;
    for (let y = 0; y <= 8; y++)
      for (let x = 0; x < o.w; x++)
        for (let z = 0; z < o.d; z++)
          if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < ((y + 3) / 11) ** 2)
            k.put(x, y + 4, z, y === 8 ? "grass_block" : y > 5 ? "dirt" : "stone");
    pavilion(k, cx - 4, 13, cz - 4, 9, 9, p);
    tree(k, cx - 7, 13, cz + 3, 7, 3);
    for (let y = 0; y < 6; y++) k.put(cx, y, cz, "chain", { axis: "y", waterlogged: "false" });
    for (let y = 9; y < 13; y++)
      for (let z = 0; z < o.d; z++) if (z % 4 === 0) leaves(k, cx - 8, y, z);
  },
  "elven-sanctuary"(k, o, p) {
    garden(k, 0, -1, 0, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    pavilion(k, c - 4, 0, z - 4, 9, 9, p);
    for (const [x, zz] of [
      [3, 3],
      [o.w - 4, 3],
      [3, o.d - 4],
      [o.w - 4, o.d - 4],
    ])
      tree(k, x, 0, zz, 12, 4);
    for (let x = 2; x < o.w - 2; x++) k.put(x, 0, z, "mossy_stone_bricks");
    for (const x of [c - 5, c + 5]) arch(k, x - 2, 1, 3, 5, 6, p);
    basin(k, c - 2, 0, o.d - 5, 5, 4, p);
  },
  blacksmith(k, o, p) {
    room(k, 0, 0, 0, o.w - 6, o.d, 5, p);
    gableRoof(k, 0, 6, 0, o.w - 6, o.d, p);
    interior(k, 0, 0, 0, o.w - 6, o.d, p);
    pavilion(k, o.w - 6, 0, 2, 6, o.d - 3, p);
    chimney(k, o.w - 4, 1, o.d - 4, 12, p);
    k.box(o.w - 5, 0, 3, 4, 1, 4, "stone_bricks");
    k.put(o.w - 4, 1, 4, "anvil", { facing: "east" });
    basin(k, o.w - 3, 0, o.d - 3, 3, 3, p);
  },
  "market-hall"(k, o, p) {
    court(k, o.w, o.d, p);
    pavilion(k, 0, 0, 0, o.w, o.d, p);
    for (let x = 2; x < o.w - 3; x += 5)
      for (const z of [2, o.d - 5]) {
        k.box(x, 1, z, 3, 1, 2, "oak_planks");
        for (const xx of [x, x + 2]) k.box(xx, 2, z + 1, 1, 2, 1, "oak_fence");
        for (let a = 0; a < 3; a++)
          k.box(x + a, 4, z - 1, 1, 1, 4, a % 2 ? "white_wool" : "red_wool");
        light(k, x + 1, 2, z);
      }
  },
  bakery(k, o, p) {
    room(k, 0, 0, 1, o.w - 4, o.d - 2, 4, p);
    gableRoof(k, 0, 5, 1, o.w - 4, o.d - 2, p, { dormer: true });
    interior(k, 0, 0, 1, o.w - 4, o.d - 2, p);
    chimney(k, o.w - 4, 0, o.d - 5, 9, p);
    k.box(o.w - 5, 0, o.d - 7, 5, 1, 5, "bricks");
    k.put(o.w - 3, 1, o.d - 7, "campfire", {
      lit: "true",
      facing: "north",
      waterlogged: "false",
      signal_fire: "false",
    });
    for (let x = 1; x < o.w - 4; x++) k.put(x, 4, -1, x % 2 ? "white_wool" : "orange_wool");
    deck(k, 0, 0, -2, o.w - 3, 3, p, { rails: false });
  },
  inn(k, o, p) {
    for (let f = 0; f < o.floors; f++) {
      room(k, 0, f * 5, 0, o.w, o.d, 4, p);
      interior(k, 0, f * 5, 0, o.w, o.d, p);
      if (f > 0)
        for (let x = 5; x < o.w - 3; x += 5) {
          k.box(x, f * 5 + 1, 3, 1, 3, o.d - 4, p.wall);
          k.box(x, f * 5 + 1, 4, 1, 2, 1, "air");
        }
      if (f < o.floors - 1) stairway(k, 1, f * 5, 3, 2, 5, "south", p);
    }
    gableRoof(k, 0, o.floors * 5, 0, o.w, o.d, p, { dormer: true });
    deck(k, -1, 5, -3, o.w + 2, 3, p);
    chimney(k, o.w - 3, 1, o.d - 3, o.floors * 5 + 7, p);
  },
  "town-hall"(k, o, p) {
    room(k, 2, 2, 6, o.w - 4, o.d - 7, 6, p);
    gableRoof(k, 2, 9, 6, o.w - 4, o.d - 7, p);
    colonnade(k, 4, 2, 1, o.w - 8, 6, p);
    stairway(k, Math.floor(o.w / 2) - 2, -1, -2, 5, 3, "south", p);
    tower(k, Math.floor(o.w / 2), 3, o.d - 5, 3, 17, p);
    interior(k, 2, 2, 6, o.w - 4, o.d - 7, p);
  },
  "crop-farm"(k, o, p) {
    k.box(0, -1, 0, o.w, 1, o.d, "dirt");
    k.box(0, 0, 0, o.w, 1, o.d, "oak_planks");
    for (let x = 1; x < o.w - 1; x++)
      for (let z = 1; z < o.d - 1; z++) {
        if (x % 5 === 0) k.put(x, 0, z, "water", { level: "0" });
        else {
          k.put(x, 0, z, "farmland", { moisture: "7" });
          k.put(x, 1, z, "wheat", { age: "7" });
        }
      }
    for (let x = 0; x < o.w; x++) for (const z of [0, o.d - 1]) k.put(x, 1, z, "oak_fence");
    for (let z = 1; z < o.d - 1; z++) for (const x of [0, o.w - 1]) k.put(x, 1, z, "oak_fence");
    k.box(Math.floor(o.w / 2), 0, 0, 2, 1, o.d, "oak_slab", slab("top"));
    k.box(Math.floor(o.w / 2), 1, 0, 2, 1, o.d, "air");
    pavilion(k, o.w - 7, 1, o.d - 7, 5, 5, p);
  },
  barn(k, o, p) {
    room(k, 0, 0, 0, o.w - 6, o.d, 5, p, { entry: false });
    gableRoof(k, 0, 6, 0, o.w - 6, o.d, p);
    doorway(k, Math.floor((o.w - 6) / 2), 1, 0, "north", p, true);
    k.box(1, 4, 2, o.w - 8, 1, o.d - 3, "oak_planks");
    for (let y = 1; y <= 4; y++)
      k.put(1, y, 1, "ladder", { facing: "south", waterlogged: "false" });
    for (let z = 3; z < o.d - 2; z += 4) {
      k.box(2, 1, z, 3, 2, 2, "hay_block", { axis: "y" });
      k.box(o.w - 10, 1, z, 1, 2, 3, "oak_fence");
    }
    deck(k, o.w - 6, 0, 2, 6, o.d - 3, p);
    k.put(o.w - 4, 1, 4, "hay_block", { axis: "y" });
  },
  greenhouse(k, o, p) {
    room(k, 0, 0, 0, o.w, o.d, 4, { ...p, wall: "glass" }, { glass: true });
    for (let x = -1; x <= o.w; x++)
      for (let z = -1; z <= o.d; z++)
        k.put(x, 5 + Math.floor(Math.min(x + 1, o.w - x) / 2), z, "glass");
    for (let x = 0; x < o.w; x += 4) k.box(x, 1, 0, 1, 4, 1, "iron_block");
    for (let x = 2; x < o.w - 2; x += 4)
      for (let z = 2; z < o.d - 2; z++) {
        k.put(x, 0, z, "farmland", { moisture: "7" });
        k.put(x, 1, z, "wheat", { age: "7" });
      }
    basin(k, Math.floor(o.w / 2) - 1, 0, o.d - 5, 3, 3, p);
  },
  windmill(k, o, p) {
    garden(k, 0, -1, 0, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    tower(k, c, 0, z, 4, 13, p);
    k.put(c, 11, z - 6, "stripped_oak_log", { axis: "z" });
    for (let a = 1; a <= 8; a++)
      for (const sign of [-1, 1]) {
        k.put(c + sign * a, 11, z - 6, "oak_fence");
        k.put(c, 11 + sign * a, z - 6, "oak_fence");
        if (a > 2) {
          k.put(c + sign * a, 12, z - 6, "white_wool");
          k.put(c + 1, 11 + sign * a, z - 6, "white_wool");
        }
      }
    room(k, 0, 0, o.d - 8, 7, 8, 3, p);
    gableRoof(k, 0, 4, o.d - 8, 7, 8, p);
  },
  "botanical-garden"(k, o, p) {
    garden(k, 0, -1, 0, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    k.box(c - 1, 0, 0, 3, 1, o.d, "gravel");
    k.box(0, 0, z - 1, o.w, 1, 3, "gravel");
    for (const x of [3, o.w - 6])
      for (const zz of [3, o.d - 6]) {
        k.box(x, 0, zz, 4, 1, 4, "dirt");
        for (let a = 0; a < 4; a++)
          for (let b = 0; b < 4; b++) k.put(x + a, 1, zz + b, (a + b) % 2 ? "poppy" : "dandelion");
      }
    pavilion(k, c - 3, 0, z - 3, 7, 7, p);
    tree(k, 3, 0, z, 8, 3);
    tree(k, o.w - 4, 0, z, 9, 3);
  },
  "stone-arch-bridge"(k, o, p) {
    const h = 6;
    for (let x = 0; x < o.w; x++) {
      const end = Math.min(x, o.w - 1 - x),
        bottom = Math.min(h - 1, Math.floor(Math.sqrt(Math.max(0, end)) * 1.8));
      k.box(x, bottom, 0, 1, h - bottom, o.d, p.wall);
      k.box(x, h, 0, 1, 1, o.d, "stone_brick_slab", slab());
      for (const z of [0, o.d - 1]) {
        k.put(x, h + 1, z, "stone_brick_wall");
        if (x % 5 === 0) light(k, x, h + 2, z);
      }
    }
    for (let i = 0; i < h; i++)
      for (let z = 1; z < o.d - 1; z++) {
        k.box(-h + i, 0, z, 1, i + 1, 1, p.base);
        k.put(-h + i, i + 1, z, "stone_brick_stairs", stair("east"));
        k.box(o.w + h - i - 1, 0, z, 1, i + 1, 1, p.base);
        k.put(o.w + h - i - 1, i + 1, z, "stone_brick_stairs", stair("west"));
      }
  },
  "suspension-bridge"(k, o, p) {
    for (let x = 0; x < o.w; x++) {
      const y = 4 + Math.floor(Math.abs(x - (o.w - 1) / 2) / 6);
      k.box(x, y, 0, 1, 1, o.d, "oak_planks");
      for (const z of [0, o.d - 1]) {
        k.put(x, y + 1, z, "oak_fence");
        const cable = y + 2 + Math.floor(Math.abs(x - (o.w - 1) / 2) / 3);
        k.put(x, cable, z, "chain", { axis: "x", waterlogged: "false" });
        if (x % 3 === 0)
          k.box(x, y + 2, z, 1, Math.max(1, cable - y - 1), 1, "chain", {
            axis: "y",
            waterlogged: "false",
          });
      }
    }
    for (const x of [2, o.w - 3])
      for (const z of [-1, o.d]) k.box(x, 0, z, 2, 12, 1, "oak_log", { axis: "y" });
    for (const x of [2, o.w - 3]) k.box(x, 11, -1, 2, 1, o.d + 2, "oak_log", { axis: "z" });
    stairway(k, -6, 0, 1, 3, 6, "east", p);
  },
  "mine-entrance"(k, o, p) {
    for (let x = 0; x < o.w; x++)
      for (let z = 0; z < o.d; z++)
        k.box(
          x,
          0,
          z,
          1,
          Math.max(2, 8 - Math.floor(Math.abs(x - o.w / 2) / 2) + Math.floor(z / 4)),
          1,
          p.wall,
        );
    const c = Math.floor(o.w / 2);
    k.box(c - 2, 1, 0, 5, 5, o.d, "air");
    for (let z = 0; z < o.d; z += 4) {
      k.box(c - 2, 1, z, 1, 5, 1, "oak_log", { axis: "y" });
      k.box(c + 2, 1, z, 1, 5, 1, "oak_log", { axis: "y" });
      k.box(c - 2, 5, z, 5, 1, 1, "oak_log", { axis: "x" });
      light(k, c - 1, 4, z);
    }
    k.box(c, 0, -4, 1, 1, o.d + 4, "stone");
    k.box(c, 1, -4, 1, 1, o.d + 4, "rail", { shape: "north_south", waterlogged: "false" });
  },
  "mountain-watchtower"(k, o, p) {
    court(k, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    tower(k, c, 0, z, 4, 15, p, { roof: false });
    deck(k, c - 5, 15, z - 5, 11, 11, p);
    pavilion(k, c - 4, 15, z - 4, 9, 9, p);
    k.put(c, 16, z, "glowstone");
    for (let y = 1; y < 16; y++)
      k.put(c, y, z + 3, "ladder", { facing: "north", waterlogged: "false" });
    k.put(c, 15, z + 3, "air");
  },
  lighthouse(k, o, p) {
    court(k, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    tower(k, c, 0, z, 4, 21, p, { roof: false });
    for (let yy = 6; yy < 21; yy += 7)
      for (let dx = -4; dx <= 4; dx++)
        for (let dz = -4; dz <= 4; dz++)
          if (Math.hypot(dx, dz) > 3 && Math.hypot(dx, dz) <= 4.25)
            k.put(c + dx, yy, z + dz, "red_concrete");
    room(k, c - 3, 22, z - 3, 7, 7, 3, { ...p, wall: "glass" }, { glass: true });
    hipRoof(k, c - 4, 26, z - 4, 9, 9, p);
    k.box(c, 23, z, 1, 2, 1, "sea_lantern");
    deck(k, c - 5, 21, z - 5, 11, 11, p);
    for (let y = 20; y < 23; y++)
      k.put(c, y, z + 3, "ladder", { facing: "north", waterlogged: "false" });
  },
  "desert-pyramid"(k, o, p) {
    const levels = Math.floor(Math.min(o.w, o.d) / 2);
    for (let y = 0; y < levels; y++) {
      k.box(y, y, y, o.w - y * 2, 1, o.d - y * 2, "sandstone");
      if (y > 0 && y < levels - 2)
        k.box(y + 2, y, y + 2, o.w - y * 2 - 4, 1, o.d - y * 2 - 4, "air");
    }
    const c = Math.floor(o.w / 2);
    k.box(c - 1, 1, 0, 3, 3, Math.floor(o.d / 2) + 2, "air");
    room(
      k,
      c - 3,
      0,
      Math.floor(o.d / 2) - 3,
      7,
      7,
      4,
      { ...p, wall: "cut_sandstone" },
      { entry: false },
    );
    k.box(c - 1, 1, Math.floor(o.d / 2) - 3, 3, 3, 1, "air");
    for (let y = 0; y < levels; y++) k.put(c, y, y, "sandstone_stairs", stair("south"));
    k.put(c, 1, Math.floor(o.d / 2), "gold_block");
    arch(k, c - 3, 1, 0, 7, 5, { ...p, wall: "chiseled_sandstone" });
  },
  "greek-temple"(k, o, p) {
    court(k, o.w, o.d, p);
    colonnade(k, 0, 2, 0, o.w, o.d, p);
    stairway(k, Math.floor(o.w / 2) - 3, -1, -3, 7, 3, "south", p);
    k.box(7, 3, 5, o.w - 14, 1, o.d - 10, "quartz_block");
  },
  "ancient-ruins"(k, o, p) {
    garden(k, 0, -1, 0, o.w, o.d, p);
    k.box(2, 0, 2, o.w - 4, 1, o.d - 4, "mossy_stone_bricks");
    for (let x = 2; x < o.w - 2; x++)
      for (const z of [2, o.d - 3]) k.box(x, 1, z, 1, 1 + ((x * 7 + z) % 6), 1, p.wall);
    for (let z = 4; z < o.d - 3; z += 5)
      for (const x of [4, o.w - 5]) k.box(x, 1, z, 1, 2 + ((x + z) % 4), 1, "cracked_stone_bricks");
    arch(k, Math.floor(o.w / 2) - 3, 1, 2, 7, 7, p);
    tree(k, o.w - 4, 0, o.d - 4, 10, 4);
    basin(k, 7, 0, 7, 5, 5, p);
  },
  "mountain-shrine"(k, o, p) {
    for (let z = 0; z < o.d; z++)
      k.box(1, -1, z, o.w - 2, Math.min(9, 2 + Math.floor(z / 2)), 1, p.base);
    stairway(k, Math.floor(o.w / 2) - 2, 0, 0, 5, 8, "south", p);
    pavilion(k, Math.floor(o.w / 2) - 4, 8, o.d - 10, 9, 9, p);
    arch(k, Math.floor(o.w / 2) - 4, 1, 1, 9, 6, { ...p, wall: "red_concrete" });
    tree(k, 3, 5, o.d - 5, 10, 3);
  },
  "memorial-plaza"(k, o, p) {
    court(k, o.w, o.d, p);
    const c = Math.floor(o.w / 2),
      z = Math.floor(o.d / 2);
    for (let y = 0; y < 3; y++) k.box(c - 4 + y, y, z - 4 + y, 9 - y * 2, 1, 9 - y * 2, p.wall);
    k.box(c - 1, 3, z - 1, 3, 10, 3, "quartz_pillar", { axis: "y" });
    hipRoof(k, c - 2, 13, z - 2, 5, 5, p);
    for (const x of [3, o.w - 4])
      for (const zz of [3, o.d - 4]) {
        k.box(x, 1, zz, 1, 3, 1, "stone_brick_wall");
        light(k, x, 4, zz);
      }
    for (const zz of [4, o.d - 5])
      for (let x = c - 3; x <= c + 3; x++)
        k.put(x, 1, zz, "oak_stairs", stair(zz < z ? "north" : "south"));
  },
  warehouse(k, o, p) {
    room(k, 0, 0, 0, o.w, o.d, 7, p, { entry: false });
    gableRoof(k, 0, 8, 0, o.w, o.d, {
      ...p,
      roof: "stone_brick_stairs",
      ridge: "stone_brick_slab",
    });
    for (const x of [4, o.w - 8]) k.box(x, 1, 0, 4, 5, 1, "air");
    for (let x = 2; x < o.w - 3; x += 5) {
      k.box(x, 1, o.d - 4, 3, 3, 3, "oak_planks");
      k.box(x, 5, o.d - 4, 3, 1, 3, "iron_block");
    }
    deck(k, -1, 0, -3, o.w + 2, 3, p, { rails: false });
  },
  workshop(k, o, p) {
    room(k, 0, 0, 0, o.w, o.d, 5, p);
    gableRoof(k, 0, 6, 0, o.w, o.d, p, { dormer: true });
    for (let x = 2; x < o.w - 2; x += 4) {
      k.put(x, 1, o.d - 2, "crafting_table");
      k.put(x, 1, 2, "anvil", { facing: "south" });
      light(k, x, 2, o.d - 2);
    }
    chimney(k, o.w - 3, 1, o.d - 3, 14, p);
    k.box(2, 1, 4, 1, 3, o.d - 7, "oak_fence");
  },
  sawmill(k, o, p) {
    pavilion(k, 0, 0, 0, o.w - 7, o.d, p);
    k.box(2, 1, 2, o.w - 12, 1, 2, "oak_log", { axis: "x" });
    for (let y = 0; y < 3; y++)
      for (let z = 2; z < 7 - y; z++) k.box(o.w - 6, y, z, 5, 1, 1, "spruce_log", { axis: "x" });
    const x = o.w - 8,
      cz = o.d - 5;
    for (let y = -4; y <= 4; y++)
      for (let z = -4; z <= 4; z++)
        if (Math.abs(Math.hypot(y, z) - 4) < 0.7 || y === 0 || z === 0)
          k.put(x, 5 + y, cz + z, "dark_oak_planks");
    k.box(x - 1, 5, cz, 3, 1, 1, "oak_log", { axis: "x" });
    basin(k, x - 2, 0, cz - 5, 5, 11, p);
  },
  "railway-depot"(k, o, p) {
    court(k, o.w, o.d, p);
    pavilion(k, 0, 0, 0, o.w, 6, p);
    for (let x = 0; x < o.w; x++) {
      k.put(x, 1, o.d - 3, "rail", { shape: "east_west", waterlogged: "false" });
      k.put(x, 0, o.d - 3, x % 2 ? "gravel" : "oak_planks");
    }
    room(k, 2, 0, 1, 7, 5, 3, p, { windows: false });
    k.box(1, 0, 6, o.w - 2, 1, 1, "stone_brick_slab", slab());
    for (let x = 12; x < o.w - 2; x += 4) k.put(x, 1, 3, "oak_stairs", stair("north"));
  },
  silos(k, o, p) {
    court(k, o.w, o.d, p);
    for (let n = 0; n < 3; n++) {
      const x = 4 + n * Math.floor((o.w - 8) / 2),
        z = Math.floor(o.d / 2),
        h = 11 + n * 3;
      tower(k, x, 0, z, 3, h, p, { roof: false });
      hipRoof(k, x - 3, h + 1, z - 3, 7, 7, { ...p, roof: "quartz_stairs", ridge: "quartz_slab" });
      k.box(x - 1, 1, z - 4, 3, 2, 1, "iron_block");
    }
    deck(k, 4, 9, Math.floor(o.d / 2) - 5, o.w - 8, 2, p);
  },
  "pvp-arena"(k, o, p) {
    court(k, o.w, o.d, p);
    k.box(2, 0, 2, o.w - 4, 1, o.d - 4, "sand");
    curtain(k, 0, 0, o.w, o.d, 5, { ...p, wall: "stone_bricks" });
    for (let r = 0; r < 3; r++)
      for (const z of [2 + r, o.d - 3 - r])
        k.box(
          2,
          r + 1,
          z,
          o.w - 4,
          1,
          1,
          "stone_brick_stairs",
          stair(z < o.d / 2 ? "north" : "south"),
        );
    for (const x of [7, o.w - 8])
      for (const z of [8, o.d - 9]) {
        k.box(x, 1, z, 2, 3, 2, "cobblestone");
        light(k, x, 4, z);
      }
    k.box(Math.floor(o.w / 2) - 1, 1, o.d - 2, 3, 3, 2, "air");
  },
  stadium(k, o, p) {
    court(k, o.w, o.d, p);
    k.box(5, 0, 5, o.w - 10, 1, o.d - 10, "green_concrete");
    for (let r = 0; r < 5; r++) {
      for (const z of [r, o.d - r - 1])
        k.box(
          r,
          5 - r,
          z,
          o.w - 2 * r,
          1,
          1,
          "stone_brick_stairs",
          stair(z < o.d / 2 ? "north" : "south"),
        );
      for (const x of [r, o.w - r - 1])
        k.box(
          x,
          5 - r,
          r,
          1,
          1,
          o.d - 2 * r,
          "stone_brick_stairs",
          stair(x < o.w / 2 ? "west" : "east"),
        );
    }
    k.box(Math.floor(o.w / 2), 0, 5, 1, 1, o.d - 10, "white_concrete");
    for (const z of [6, o.d - 7]) {
      k.box(Math.floor(o.w / 2) - 3, 1, z, 1, 3, 1, "iron_bars");
      k.box(Math.floor(o.w / 2) + 3, 1, z, 1, 3, 1, "iron_bars");
      k.box(Math.floor(o.w / 2) - 3, 4, z, 7, 1, 1, "iron_bars");
    }
    for (const x of [0, o.w - 1])
      for (const z of [0, o.d - 1]) {
        k.box(x, 0, z, 1, 12, 1, "iron_block");
        k.box(x - 1, 12, z - 1, 3, 1, 3, "sea_lantern");
      }
  },
  "hedge-maze"(k, o, p) {
    garden(k, 0, -1, 0, o.w, o.d, p);
    k.box(0, 0, 0, o.w, 1, o.d, "moss_block");
    // Serpentine traversable route, alternating gates rather than disconnected cells.
    for (let x = 1; x < o.w - 1; x += 4)
      for (let z = 1; z < o.d - 1; z++) {
        const gate = Math.floor(x / 4) % 2 === 0 ? z < 4 : z > o.d - 5;
        if (!gate) for (let y = 1; y <= 3; y++) leaves(k, x, y, z);
      }
    for (let x = 0; x < o.w; x++)
      for (const z of [0, o.d - 1])
        if (x !== 2 && x !== o.w - 3) for (let y = 1; y <= 3; y++) leaves(k, x, y, z);
    pavilion(k, o.w - 7, 0, Math.floor(o.d / 2) - 2, 5, 5, p);
  },
  "zen-garden"(k, o, p) {
    court(k, o.w, o.d, p);
    k.box(0, 0, 0, o.w, 1, o.d, "gravel");
    basin(k, 3, 0, 5, 9, 9, p);
    for (let z = 4; z < 15; z++) {
      k.put(7, 1 + Math.floor((5 - Math.abs(9 - z)) / 3), z, "oak_slab", slab("top"));
    }
    pavilion(k, o.w - 9, 0, o.d - 9, 7, 7, p);
    tree(k, 3, 0, o.d - 4, 8, 3);
    for (const [x, z, h] of [
      [3, 3, 3],
      [o.w - 4, 3, 4],
      [o.w - 5, o.d - 4, 2],
    ]) {
      k.box(x, 1, z, 2, h, 2, "andesite");
      k.put(x, h + 1, z, "stone_slab", slab());
    }
  },
  "fountain-plaza"(k, o, p) {
    court(k, o.w, o.d, p);
    const cx = Math.floor(o.w / 2),
      cz = Math.floor(o.d / 2);
    basin(k, cx - 6, 0, cz - 6, 13, 13, p);
    basin(k, cx - 3, 3, cz - 3, 7, 7, p);
    k.box(cx - 1, 0, cz - 1, 3, 8, 3, "quartz_pillar", { axis: "y" });
    basin(k, cx - 1, 8, cz - 1, 3, 3, p);
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      k.box(cx + dx * 4, 0, cz + dz * 4, 1, 3, 1, "quartz_pillar", { axis: "y" });
    for (const x of [3, o.w - 4])
      for (const z of [3, o.d - 4]) {
        tree(k, x, 0, z, 7, 2);
        light(k, x - 1, 1, z - 1);
      }
  },
};
const modern = new Set([
  "luxury-mansion",
  "suburban-house",
  "duplex",
  "penthouse-tower",
  "warehouse",
  "silos",
]);
const fantasy = new Set([
  "wizard-tower",
  "enchanted-library",
  "dragon-shrine",
  "floating-island",
  "elven-sanctuary",
]);
export const CATALOG_BUILDERS = Object.fromEntries(
  Object.entries(recipes).map(([id, recipe]) => [
    id,
    (o) => {
      const k = architect(),
        p = palette(o, modern.has(id) ? "modern" : fantasy.has(id) ? "fantasy" : "rustic");
      recipe(k, o, p);
      return k.finish();
    },
  ]),
);
