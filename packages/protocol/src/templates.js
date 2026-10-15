/**
 * Fifty shared structure presets. Local voxel plans only.
 * Desktop, mobile, and the build worker must all call generateTemplate.
 */
import { boundsOf, planFingerprint, rotateBlocks, mirrorBlocks } from "./blueprint-edit.js";

const GENERATOR_VERSION = 1;

function kit() {
  const out = [];
  const put = (x, y, z, block) => {
    if (typeof block === "string") out.push({ x: x | 0, y: y | 0, z: z | 0, block });
  };
  const solid = (x0, y0, z0, x1, y1, z1, block) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1) put(x, y, z, block);
      }
    }
  };
  const shell = (x0, y0, z0, x1, y1, z1, block) => {
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        for (let z = z0; z <= z1; z += 1) {
          if (x === x0 || x === x1 || z === z0 || z === z1 || y === y0 || y === y1) put(x, y, z, block);
        }
      }
    }
  };
  const column = (x, z, y0, y1, block) => {
    for (let y = y0; y <= y1; y += 1) put(x, y, z, block);
  };
  const door = (x, z) => {
    put(x, 1, z, "air");
    put(x, 2, z, "air");
  };
  return { out, put, solid, shell, column, door };
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function dedupe(blocks) {
  const map = new Map();
  for (const block of blocks) {
    if (!/^[a-z0-9_]+$/.test(block.block)) continue;
    map.set(`${block.x}|${block.y}|${block.z}`, block);
  }
  return [...map.values()];
}

const BUILDERS = {
  "starter-cottage"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, o.material);
    k.door(Math.floor(o.w / 2), 0);
    k.put(2, 2, 0, "glass_pane");
    k.put(o.w - 3, 2, o.d - 1, "glass_pane");
    k.solid(1, 5, 1, o.w - 2, 5, o.d - 2, "oak_planks");
    k.column(1, 1, 5, 7, "cobblestone");
    k.put(1, 8, 1, "campfire");
    return k.out;
  },
  "oak-cabin"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, "oak_planks");
    for (const [x, z] of [[0, 0], [0, o.d - 1], [o.w - 1, 0], [o.w - 1, o.d - 1]]) k.column(x, z, 0, 5, "oak_log");
    k.solid(-1, 0, -2, o.w, 0, -1, "oak_slab");
    k.column(-1, -2, 0, 2, "oak_fence");
    k.column(o.w, -2, 0, 2, "oak_fence");
    k.door(Math.floor(o.w / 2), 0);
    return k.out;
  },
  "forest-treehouse"(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    k.column(cx, cz, 0, 7, "oak_log");
    k.solid(cx - 3, 8, cz - 3, cx + 3, 8, cz + 3, "oak_planks");
    k.shell(cx - 2, 9, cz - 2, cx + 2, 12, cz + 2, "oak_planks");
    k.door(cx, cz - 2);
    k.put(cx, 8, cz - 4, "ladder");
    for (let y = 1; y <= 8; y += 1) k.put(cx, y, cz - 1, "ladder");
    k.put(cx + 2, 10, cz + 2, "lantern");
    return k.out;
  },
  "lakeside-cottage"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, o.material);
    k.door(1, 0);
    k.solid(0, 0, o.d, o.w - 1, 0, o.d + 5, "oak_planks");
    for (let i = 0; i < 4; i += 1) {
      k.column(0, o.d + i, -1, 0, "oak_fence");
      k.column(o.w - 1, o.d + i, -1, 0, "oak_fence");
    }
    k.put(Math.floor(o.w / 2), -1, o.d + 4, "water");
    return k.out;
  },
  "cliffside-house"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, 2, "stone");
    k.solid(1, 1, 1, o.w - 2, 1, 4, "stone");
    k.shell(2, 2, 2, o.w - 1, 6, o.d - 1, o.material);
    k.door(Math.floor(o.w / 2), 2);
    k.solid(2, 7, 2, o.w - 1, 7, o.d - 1, "stone_bricks");
    return k.out;
  },
  "glass-villa"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "smooth_quartz");
    k.shell(0, 1, 0, o.w - 1, 4, o.d - 1, "glass");
    k.solid(0, 5, 0, o.w - 1, 5, o.d - 1, "smooth_quartz");
    k.solid(o.w + 1, 0, 2, o.w + 4, 0, o.d - 3, "water");
    k.door(Math.floor(o.w / 2), 0);
    return k.out;
  },
  "luxury-mansion"(o) {
    const k = kit();
    k.shell(3, 0, 0, o.w - 4, 6, o.d - 1, "quartz_block");
    k.shell(0, 0, 2, 3, 4, o.d - 3, "quartz_block");
    k.shell(o.w - 4, 0, 2, o.w - 1, 4, o.d - 3, "smooth_quartz");
    k.door(Math.floor(o.w / 2), 0);
    k.column(3, 0, 0, 7, "quartz_block");
    k.column(o.w - 4, 0, 0, 7, "quartz_block");
    return k.out;
  },
  "suburban-house"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 5, 4, o.d - 1, o.material);
    k.shell(o.w - 5, 0, 1, o.w - 1, 3, o.d - 2, "white_concrete");
    k.door(2, 0);
    k.put(o.w - 3, 1, 1, "air");
    k.put(o.w - 3, 2, 1, "air");
    k.solid(0, 5, 0, o.w - 5, 5, o.d - 1, "bricks");
    return k.out;
  },
  duplex(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 5, o.d - 1, o.material);
    const mid = Math.floor(o.w / 2);
    k.solid(mid, 1, 1, mid, 5, o.d - 2, "stone_bricks");
    k.door(2, 0);
    k.door(o.w - 3, 0);
    k.put(2, 2, o.d - 1, "glass_pane");
    k.put(o.w - 3, 2, o.d - 1, "glass_pane");
    return k.out;
  },
  "penthouse-tower"(o) {
    const k = kit();
    k.shell(2, 0, 2, o.w - 3, 10, o.d - 3, "stone");
    k.shell(1, 11, 1, o.w - 2, 14, o.d - 2, "glass");
    k.solid(1, 15, 1, o.w - 2, 15, o.d - 2, "smooth_quartz");
    k.door(Math.floor(o.w / 2), 2);
    k.put(Math.floor(o.w / 2), 13, 1, "lantern");
    return k.out;
  },
  "stone-keep"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 8, o.d - 1, "stone_bricks");
    for (let x = 0; x < o.w; x += 1) if (x % 2 === 0) k.put(x, 9, 0, "stone_brick_wall");
    k.door(Math.floor(o.w / 2), 0);
    k.put(Math.floor(o.w / 2), 4, 0, "glass_pane");
    return k.out;
  },
  "royal-castle"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 6, o.d - 1, "stone_bricks");
    for (const [x, z] of [[0, 0], [0, o.d - 1], [o.w - 1, 0], [o.w - 1, o.d - 1]]) {
      k.column(x, z, 0, 9, "stone_bricks");
      k.put(x, 10, z, "stone_brick_wall");
    }
    k.door(Math.floor(o.w / 2), 0);
    k.solid(3, 0, 3, o.w - 4, 0, o.d - 4, "stone");
    return k.out;
  },
  gatehouse(o) {
    const k = kit();
    k.shell(0, 0, 0, 3, 7, o.d - 1, "stone_bricks");
    k.shell(o.w - 4, 0, 0, o.w - 1, 7, o.d - 1, "stone_bricks");
    k.solid(3, 5, 0, o.w - 4, 6, 2, "stone_bricks");
    k.put(Math.floor(o.w / 2), 1, 1, "air");
    k.put(Math.floor(o.w / 2), 2, 1, "air");
    k.put(Math.floor(o.w / 2), 3, 1, "air");
    return k.out;
  },
  "defensive-wall"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 4, 1, "stone_bricks");
    k.solid(0, 5, 0, o.w - 1, 5, 1, "stone_brick_slab");
    for (let x = 0; x < o.w; x += 2) k.put(x, 6, 0, "stone_brick_wall");
    k.column(0, 0, 0, 7, "stone_bricks");
    k.column(o.w - 1, 0, 0, 7, "stone_bricks");
    return k.out;
  },
  citadel(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 5, o.d - 1, "deepslate_bricks");
    k.shell(3, 0, 3, o.w - 4, 9, o.d - 4, "stone_bricks");
    k.door(Math.floor(o.w / 2), 0);
    k.door(Math.floor(o.w / 2), 3);
    return k.out;
  },
  "wizard-tower"(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    for (let y = 0; y < 12; y += 1) {
      const r = y < 8 ? 3 : 2;
      for (let x = cx - r; x <= cx + r; x += 1) {
        for (let z = cz - r; z <= cz + r; z += 1) {
          if (Math.abs(x - cx) === r || Math.abs(z - cz) === r) k.put(x, y, z, "deepslate_tiles");
        }
      }
    }
    k.put(cx, 12, cz, "amethyst_block");
    k.door(cx, cz - 3);
    return k.out;
  },
  "enchanted-library"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 5, o.d - 1, "dark_oak_planks");
    for (let z = 2; z < o.d - 2; z += 1) {
      k.put(1, 1, z, "bookshelf");
      k.put(1, 2, z, "bookshelf");
      k.put(o.w - 2, 1, z, "bookshelf");
      k.put(o.w - 2, 2, z, "bookshelf");
    }
    k.put(Math.floor(o.w / 2), 1, Math.floor(o.d / 2), "lantern");
    k.door(Math.floor(o.w / 2), 0);
    return k.out;
  },
  "dragon-shrine"(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    for (let x = 1; x < o.w - 1; x += 1) {
      for (let z = 1; z < o.d - 1; z += 1) {
        if ((x - cx) ** 2 + (z - cz) ** 2 <= 16) k.put(x, 0, z, "deepslate_tiles");
      }
    }
    k.column(cx, cz, 1, 4, "crying_obsidian");
    k.put(cx - 3, 2, cz, "bone_block");
    k.put(cx + 3, 2, cz, "bone_block");
    k.put(cx - 4, 3, cz, "bone_block");
    k.put(cx + 4, 3, cz, "bone_block");
    return k.out;
  },
  "floating-island"(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    for (let x = 0; x < o.w; x += 1) {
      for (let z = 0; z < o.d; z += 1) {
        if ((x - cx) ** 2 + (z - cz) ** 2 <= 18) {
          k.put(x, 8, z, "grass_block");
          k.put(x, 7, z, "dirt");
        }
      }
    }
    k.shell(cx - 2, 9, cz - 2, cx + 2, 12, cz + 2, "calcite");
    k.column(cx, cz, 0, 6, "chain");
    return k.out;
  },
  "elven-sanctuary"(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    for (let i = 0; i < 8; i += 1) {
      const x = cx + Math.round(Math.cos((i / 8) * Math.PI * 2) * 4);
      const z = cz + Math.round(Math.sin((i / 8) * Math.PI * 2) * 4);
      k.column(x, z, 0, 6, "stripped_oak_log");
      k.put(x, 7, z, "oak_leaves");
    }
    k.put(cx, 0, cz, "moss_block");
    k.put(cx, 1, cz, "lantern");
    return k.out;
  },
  blacksmith(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, "bricks");
    k.column(o.w - 2, o.d - 2, 1, 7, "bricks");
    k.put(o.w - 2, 8, o.d - 2, "campfire");
    k.put(2, 1, 2, "anvil");
    k.door(2, 0);
    return k.out;
  },
  "market-hall"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "cobblestone");
    for (let x = 1; x < o.w - 1; x += 3) {
      k.solid(x, 3, 1, x + 1, 3, 3, "red_wool");
      k.column(x, 1, 1, 2, "oak_fence");
      k.column(x + 1, 3, 1, 2, "oak_fence");
    }
    k.solid(0, 4, 0, o.w - 1, 4, 1, "dark_oak_planks");
    return k.out;
  },
  bakery(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, "mud_bricks");
    k.solid(o.w, 0, 1, o.w + 2, 2, 3, "bricks");
    k.put(o.w + 1, 1, 2, "campfire");
    k.door(2, 0);
    k.put(3, 1, 2, "composter");
    return k.out;
  },
  inn(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 7, o.d - 1, "spruce_planks");
    k.solid(1, 4, 1, o.w - 2, 4, o.d - 2, "spruce_planks");
    k.door(Math.floor(o.w / 2), 0);
    k.column(0, -1, 0, 3, "oak_fence");
    k.put(1, 3, -1, "lantern");
    k.put(2, 2, 0, "glass_pane");
    k.put(2, 6, 0, "glass_pane");
    return k.out;
  },
  "town-hall"(o) {
    const k = kit();
    k.solid(2, 0, 0, o.w - 3, 0, 2, "stone");
    k.solid(3, 1, 1, o.w - 4, 1, 2, "stone");
    k.shell(1, 2, 2, o.w - 2, 7, o.d - 1, "quartz_block");
    for (let x = 2; x < o.w - 2; x += 3) k.column(x, 2, 2, 7, "quartz_pillar");
    k.door(Math.floor(o.w / 2), 2);
    return k.out;
  },
  "crop-farm"(o) {
    const k = kit();
    for (let x = 0; x < o.w; x += 1) {
      for (let z = 0; z < o.d; z += 1) k.put(x, 0, z, x === Math.floor(o.w / 2) ? "water" : "farmland");
    }
    k.solid(-1, 0, -1, o.w, 0, -1, "oak_fence");
    k.solid(-1, 0, o.d, o.w, 0, o.d, "oak_fence");
    return k.out;
  },
  barn(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 5, o.d - 1, "spruce_planks");
    k.solid(1, 1, o.d, o.w - 2, 1, o.d + 3, "hay_block");
    k.solid(0, 0, o.d, 0, 1, o.d + 3, "oak_fence");
    k.solid(o.w - 1, 0, o.d, o.w - 1, 1, o.d + 3, "oak_fence");
    k.door(Math.floor(o.w / 2), 0);
    return k.out;
  },
  greenhouse(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, "glass");
    k.solid(0, 4, 0, o.w - 1, 4, o.d - 1, "glass");
    for (let z = 2; z < o.d - 1; z += 2) k.solid(2, 0, z, o.w - 3, 0, z, "farmland");
    k.door(Math.floor(o.w / 2), 0);
    return k.out;
  },
  windmill(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    k.shell(cx - 2, 0, cz - 2, cx + 2, 8, cz + 2, "oak_planks");
    for (let i = 1; i <= 4; i += 1) {
      k.put(cx + i, 7, cz - 2, "oak_fence");
      k.put(cx - i, 7, cz - 2, "oak_fence");
      k.put(cx, 7 + i, cz - 2, "oak_fence");
      k.put(cx, 7 - i, cz - 2, "oak_fence");
    }
    k.door(cx, cz - 2);
    return k.out;
  },
  "botanical-garden"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "grass_block");
    k.solid(0, 0, Math.floor(o.d / 2), o.w - 1, 0, Math.floor(o.d / 2), "gravel");
    k.solid(Math.floor(o.w / 2), 0, 0, Math.floor(o.w / 2), 0, o.d - 1, "gravel");
    k.solid(1, 0, 1, 3, 1, 3, "oak_fence");
    k.put(2, 0, 2, "grass_block");
    k.solid(o.w - 4, 0, 1, o.w - 2, 1, 3, "oak_fence");
    return k.out;
  },
  "stone-arch-bridge"(o) {
    const k = kit();
    const deck = 4;
    k.solid(0, deck, 0, o.w - 1, deck, 2, "stone_bricks");
    for (let x = 0; x < o.w; x += 1) {
      const rise = Math.max(0, deck - 1 - Math.round(3 * (1 - ((x - (o.w - 1) / 2) / ((o.w - 1) / 2)) ** 2)));
      k.put(x, rise, 1, "stone_bricks");
    }
    k.column(0, 0, 0, deck, "stone_bricks");
    k.column(o.w - 1, 0, 0, deck, "stone_bricks");
    return k.out;
  },
  "suspension-bridge"(o) {
    const k = kit();
    k.column(0, 0, 0, 7, "oak_log");
    k.column(0, 2, 0, 7, "oak_log");
    k.column(o.w - 1, 0, 0, 7, "oak_log");
    k.column(o.w - 1, 2, 0, 7, "oak_log");
    k.solid(0, 3, 0, o.w - 1, 3, 2, "oak_planks");
    for (let x = 1; x < o.w - 1; x += 1) {
      const y = 6 - Math.round((3 * Math.min(x, o.w - 1 - x)) / Math.max(1, Math.floor(o.w / 2)));
      k.put(x, y, 0, "chain");
      k.put(x, y, 2, "chain");
    }
    return k.out;
  },
  "mine-entrance"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 5, o.d - 1, "stone");
    k.solid(Math.floor(o.w / 2) - 1, 1, 0, Math.floor(o.w / 2) + 1, 3, 4, "air");
    k.shell(Math.floor(o.w / 2) - 2, 0, 0, Math.floor(o.w / 2) + 2, 4, 0, "oak_log");
    k.put(Math.floor(o.w / 2), 3, 1, "lantern");
    return k.out;
  },
  "mountain-watchtower"(o) {
    const k = kit();
    k.shell(1, 0, 1, o.w - 2, 9, o.d - 2, "cobblestone");
    k.solid(0, 10, 0, o.w - 1, 10, o.d - 1, "oak_planks");
    k.solid(0, 11, 0, o.w - 1, 11, 0, "oak_fence");
    k.solid(0, 11, o.d - 1, o.w - 1, 11, o.d - 1, "oak_fence");
    for (let y = 1; y <= 10; y += 1) k.put(2, y, 2, "ladder");
    k.put(Math.floor(o.w / 2), 11, Math.floor(o.d / 2), "lantern");
    return k.out;
  },
  lighthouse(o) {
    const k = kit();
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    for (let y = 0; y < 12; y += 1) {
      const r = y < 9 ? 2 : 3;
      for (let x = cx - r; x <= cx + r; x += 1) {
        for (let z = cz - r; z <= cz + r; z += 1) {
          const edge = Math.abs(x - cx) === r || Math.abs(z - cz) === r;
          if (y >= 9 && y <= 11 && edge) k.put(x, y, z, "glass");
          else if (edge || y === 0) k.put(x, y, z, "white_concrete");
        }
      }
    }
    k.put(cx, 12, cz, "sea_lantern");
    k.door(cx, cz - 2);
    return k.out;
  },
  "desert-pyramid"(o) {
    const k = kit();
    const layers = Math.min(o.w, o.d, 7);
    for (let i = 0; i < layers; i += 1) {
      k.solid(i, i, i, o.w - 1 - i, i, o.d - 1 - i, "sandstone");
    }
    k.put(Math.floor(o.w / 2), 1, 0, "air");
    k.put(Math.floor(o.w / 2), 2, 1, "air");
    return k.out;
  },
  "greek-temple"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "quartz_block");
    for (let x = 1; x < o.w - 1; x += 2) {
      k.column(x, 1, 1, 4, "quartz_pillar");
      k.column(x, o.d - 2, 1, 4, "quartz_pillar");
    }
    k.solid(0, 5, 0, o.w - 1, 5, o.d - 1, "quartz_block");
    k.solid(1, 6, 1, o.w - 2, 6, Math.floor(o.d / 2), "smooth_quartz");
    return k.out;
  },
  "ancient-ruins"(o) {
    const k = kit();
    k.solid(0, 0, 0, 1, 4, 0, "mossy_cobblestone");
    k.solid(o.w - 2, 0, 0, o.w - 1, 2, 0, "cracked_stone_bricks");
    k.solid(0, 0, o.d - 1, 0, 3, o.d - 1, "stone_bricks");
    k.solid(2, 0, 2, o.w - 3, 0, o.d - 3, "gravel");
    k.put(Math.floor(o.w / 2), 1, Math.floor(o.d / 2), "mossy_cobblestone");
    return k.out;
  },
  "mountain-shrine"(o) {
    const k = kit();
    for (let step = 0; step < 4; step += 1) k.solid(step, step, step, o.w - 1 - step, step, step, "stone");
    k.solid(3, 4, 4, o.w - 4, 4, o.d - 2, "stone_bricks");
    k.column(4, o.d - 3, 5, 7, "stone_bricks");
    k.column(o.w - 5, o.d - 3, 5, 7, "stone_bricks");
    k.put(Math.floor(o.w / 2), 5, o.d - 3, "lantern");
    return k.out;
  },
  "memorial-plaza"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "smooth_stone");
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    k.column(cx, cz, 1, 5, "quartz_pillar");
    k.put(cx, 6, cz, "sea_lantern");
    k.solid(1, 0, 1, 1, 1, o.d - 2, "stone_brick_wall");
    return k.out;
  },
  warehouse(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 5, o.d - 1, "gray_concrete");
    k.solid(0, 6, 0, o.w - 1, 6, o.d - 1, "gray_concrete");
    k.put(2, 1, 0, "air");
    k.put(2, 2, 0, "air");
    k.put(3, 1, 0, "air");
    k.put(3, 2, 0, "air");
    k.put(o.w - 3, 1, 0, "air");
    k.put(o.w - 3, 2, 0, "air");
    return k.out;
  },
  workshop(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 4, o.d - 1, "spruce_planks");
    k.solid(2, 1, 2, 4, 1, 2, "crafting_table");
    k.put(o.w - 3, 1, 2, "smithing_table");
    k.door(Math.floor(o.w / 2), 0);
    k.put(2, 2, o.d - 1, "glass_pane");
    return k.out;
  },
  sawmill(o) {
    const k = kit();
    k.shell(0, 0, 2, o.w - 4, 4, o.d - 1, "oak_planks");
    for (let y = 0; y < 3; y += 1) k.solid(o.w - 3, y, 2, o.w - 1, y, 4, "oak_log");
    const cx = o.w - 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      k.put(cx + Math.round(Math.cos(a) * 2), 3 + Math.round(Math.sin(a) * 2), 0, "oak_fence");
    }
    return k.out;
  },
  "railway-depot"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, 2, "stone");
    k.solid(0, 0, 3, o.w - 1, 0, 3, "rail");
    k.shell(0, 1, 0, 3, 4, 2, "bricks");
    k.solid(0, 5, 0, o.w - 1, 5, 2, "dark_oak_planks");
    k.column(0, 0, 1, 5, "oak_fence");
    k.column(o.w - 1, 0, 1, 5, "oak_fence");
    return k.out;
  },
  silos(o) {
    const k = kit();
    const places = [2, Math.floor(o.w / 2), o.w - 3];
    for (const cx of places) {
      for (let y = 0; y < 7; y += 1) {
        for (let z = 2; z <= 6; z += 1) {
          for (let x = cx - 2; x <= cx + 2; x += 1) {
            if (Math.abs(x - cx) === 2 || z === 2 || z === 6) k.put(x, y, z, "white_terracotta");
          }
        }
      }
      k.put(cx, 7, 4, "hay_block");
    }
    return k.out;
  },
  "pvp-arena"(o) {
    const k = kit();
    k.shell(0, 0, 0, o.w - 1, 3, o.d - 1, "stone_bricks");
    k.solid(1, 0, 1, o.w - 2, 0, o.d - 2, "sand");
    k.put(Math.floor(o.w / 2), 1, 0, "air");
    k.put(Math.floor(o.w / 2), 2, 0, "air");
    k.put(Math.floor(o.w / 2), 1, o.d - 1, "air");
    k.put(Math.floor(o.w / 2), 2, o.d - 1, "air");
    return k.out;
  },
  stadium(o) {
    const k = kit();
    k.solid(3, 0, 3, o.w - 4, 0, o.d - 4, "green_concrete");
    k.solid(2, 1, 2, o.w - 3, 1, o.d - 3, "stone");
    k.solid(1, 2, 1, o.w - 2, 2, o.d - 2, "stone");
    k.solid(0, 3, 0, o.w - 1, 3, o.d - 1, "stone_bricks");
    k.solid(3, 1, 3, o.w - 4, 3, o.d - 4, "air");
    k.solid(3, 0, 3, o.w - 4, 0, o.d - 4, "green_concrete");
    return k.out;
  },
  "hedge-maze"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "grass_block");
    for (let x = 0; x < o.w; x += 1) {
      for (let z = 0; z < o.d; z += 1) {
        const wall = x % 4 === 0 || z % 4 === 0;
        const gate = (x === 2 && z % 4 === 0) || (z === 2 && x % 4 === 0);
        if (wall && !gate) {
          k.put(x, 1, z, "oak_leaves");
          k.put(x, 2, z, "oak_leaves");
        }
      }
    }
    return k.out;
  },
  "zen-garden"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "gravel");
    k.solid(2, 0, 2, 5, 0, 4, "water");
    k.column(o.w - 3, 2, 1, 3, "stone");
    k.put(o.w - 3, 4, 2, "lantern");
    k.solid(1, 1, o.d - 2, o.w - 2, 1, o.d - 2, "oak_fence");
    return k.out;
  },
  "fountain-plaza"(o) {
    const k = kit();
    k.solid(0, 0, 0, o.w - 1, 0, o.d - 1, "stone_bricks");
    const cx = Math.floor(o.w / 2);
    const cz = Math.floor(o.d / 2);
    k.shell(cx - 2, 1, cz - 2, cx + 2, 1, cz + 2, "stone_bricks");
    k.put(cx, 1, cz, "water");
    k.column(cx, cz, 2, 4, "stone_bricks");
    k.put(cx, 5, cz, "water");
    for (let i = -3; i <= 3; i += 3) {
      k.put(cx + i, 1, cz - 3, "lantern");
      k.put(cx + i, 1, cz + 3, "lantern");
    }
    return k.out;
  },
};

const SPECS = [
  ["starter-cottage", "Starter Survival Cottage", "Homes & Cabins", "A one-room cottage with a chimney.", 9, 8, 1, "oak_planks", "simple", ["home"], ["The chimney is decorative."]],
  ["oak-cabin", "Rustic Oak Cabin", "Homes & Cabins", "A log-corner cabin with a front porch.", 9, 8, 1, "oak_planks", "simple", ["home"], []],
  ["forest-treehouse", "Forest Treehouse", "Homes & Cabins", "A hut on a raised platform with a ladder trunk.", 11, 11, 1, "oak_planks", "moderate", ["home"], []],
  ["lakeside-cottage", "Lakeside Cottage", "Homes & Cabins", "A cottage with a pier past the rear wall.", 9, 8, 1, "spruce_planks", "simple", ["home"], ["The water block marks the end of the pier. It does not generate a lake."]],
  ["cliffside-house", "Cliffside Mountain House", "Homes & Cabins", "A house set on stepped stone pads.", 11, 10, 1, "stone_bricks", "moderate", ["home"], []],
  ["glass-villa", "Modern Glass Villa", "Modern & Luxury", "A glass-walled villa with a side water court.", 11, 9, 1, "glass", "moderate", ["modern"], []],
  ["luxury-mansion", "Luxury Mansion", "Modern & Luxury", "A central hall with two lower wings.", 15, 11, 1, "quartz_block", "moderate", ["modern"], []],
  ["suburban-house", "Contemporary Suburban House", "Modern & Luxury", "A house with an attached garage bay.", 13, 9, 1, "white_concrete", "simple", ["modern"], ["The garage opening is architectural. It does not contain a vehicle."]],
  ["duplex", "Modern Duplex", "Modern & Luxury", "Two dwellings split by a full-height party wall.", 13, 8, 1, "bricks", "simple", ["modern"], []],
  ["penthouse-tower", "Penthouse Tower", "Modern & Luxury", "A stone shaft topped by a glass penthouse.", 11, 11, 1, "stone", "moderate", ["modern"], []],
  ["stone-keep", "Medieval Stone Keep", "Medieval & Fortified", "A square keep with a crenellated rim.", 11, 11, 1, "stone_bricks", "moderate", ["castle"], []],
  ["royal-castle", "Royal Castle", "Medieval & Fortified", "A courtyard wall with four corner towers.", 15, 15, 1, "stone_bricks", "large", ["castle"], []],
  ["gatehouse", "Castle Gatehouse", "Medieval & Fortified", "Twin towers with an arched passage between them.", 13, 7, 1, "stone_bricks", "moderate", ["castle"], []],
  ["defensive-wall", "Fortified Defensive Wall", "Medieval & Fortified", "A long wall with a walkway and merlons.", 17, 3, 1, "stone_bricks", "simple", ["castle"], []],
  ["citadel", "Grand Fortress Citadel", "Medieval & Fortified", "An outer wall around an inner keep.", 15, 15, 1, "deepslate_bricks", "large", ["castle"], []],
  ["wizard-tower", "Wizard Tower", "Fantasy & Magic", "A tower that steps inward near the top.", 11, 11, 1, "deepslate_tiles", "moderate", ["fantasy"], []],
  ["enchanted-library", "Enchanted Library", "Fantasy & Magic", "A hall lined with bookshelves.", 11, 9, 1, "dark_oak_planks", "moderate", ["fantasy"], ["The bookshelves are decorative."]],
  ["dragon-shrine", "Dragon Shrine", "Fantasy & Magic", "A round dais, a central spire, and two wing spars.", 13, 13, 1, "deepslate_tiles", "moderate", ["fantasy"], []],
  ["floating-island", "Floating Island Temple", "Fantasy & Magic", "A dirt disk in the air with a small temple and a hanging chain.", 13, 13, 1, "calcite", "moderate", ["fantasy"], ["The island is a build plan, not a physics object."]],
  ["elven-sanctuary", "Elven Woodland Sanctuary", "Fantasy & Magic", "An open ring of timber columns.", 13, 13, 1, "stripped_oak_log", "moderate", ["fantasy"], []],
  ["blacksmith", "Village Blacksmith", "Village & Community", "A brick shop with a chimney and an anvil.", 9, 8, 1, "bricks", "simple", ["village"], ["The forge is decorative and is not a working smelter."]],
  ["market-hall", "Medieval Market Hall", "Village & Community", "A row of stall canopies under a long roof.", 15, 7, 1, "dark_oak_planks", "moderate", ["village"], []],
  ["bakery", "Village Bakery", "Village & Community", "A shop with an outdoor brick oven.", 9, 8, 1, "mud_bricks", "simple", ["village"], ["The oven does not smelt items."]],
  ["inn", "Traveler's Inn", "Village & Community", "A two-storey inn with a hanging lantern.", 13, 8, 2, "spruce_planks", "moderate", ["village"], []],
  ["town-hall", "Town Hall", "Village & Community", "A columned hall reached by steps.", 13, 10, 1, "quartz_block", "moderate", ["village"], []],
  ["crop-farm", "Crop Farm", "Farms & Nature", "Fenced farmland split by a water channel.", 11, 9, 1, "farmland", "simple", ["farm"], ["These are crop plots and a water channel, not a redstone harvester."]],
  ["barn", "Rustic Animal Barn", "Farms & Nature", "A barn with a fenced hay yard.", 11, 8, 1, "spruce_planks", "simple", ["farm"], ["The pen does not contain animals."]],
  ["greenhouse", "Glass Greenhouse", "Farms & Nature", "A glass house with interior growing beds.", 11, 9, 1, "glass", "simple", ["farm"], []],
  ["windmill", "Windmill Farm", "Farms & Nature", "A mill tower with four blade arms.", 11, 11, 1, "oak_planks", "moderate", ["farm"], ["The blades are a static build. They do not rotate or process crops."]],
  ["botanical-garden", "Botanical Garden", "Farms & Nature", "Crossing gravel paths and two fenced beds.", 13, 13, 1, "grass_block", "simple", ["garden"], []],
  ["stone-arch-bridge", "Stone Arch Bridge", "Infrastructure", "A deck over a stone arch.", 13, 3, 1, "stone_bricks", "moderate", ["bridge"], []],
  ["suspension-bridge", "Wooden Suspension Bridge", "Infrastructure", "An elevated deck hung from two timber towers by chains.", 15, 3, 1, "oak_planks", "moderate", ["bridge"], ["The chains are decorative supports, not a moving mechanism."]],
  ["mine-entrance", "Mine Entrance", "Infrastructure", "A stone face with a framed tunnel mouth.", 11, 7, 1, "stone", "simple", ["industry"], ["The tunnel is only a few blocks deep."]],
  ["mountain-watchtower", "Mountain Watchtower", "Infrastructure", "A cobblestone shaft with a fenced lookout.", 9, 9, 1, "cobblestone", "moderate", ["tower"], []],
  ["lighthouse", "Coastal Lighthouse", "Infrastructure", "A white tower with a glass lantern room.", 11, 11, 1, "white_concrete", "moderate", ["tower"], ["The sea lantern is a light block, not a rotating beacon."]],
  ["desert-pyramid", "Desert Pyramid", "Temples & Monuments", "A stepped sandstone pyramid with an entrance cut.", 13, 13, 1, "sandstone", "moderate", ["monument"], []],
  ["greek-temple", "Greek-Style Temple", "Temples & Monuments", "A podium, colonnade, and pediment.", 13, 9, 1, "quartz_block", "moderate", ["monument"], []],
  ["ancient-ruins", "Ancient Ruins", "Temples & Monuments", "Broken wall fragments around a gravel floor.", 13, 11, 1, "mossy_cobblestone", "simple", ["monument"], []],
  ["mountain-shrine", "Mountain Shrine", "Temples & Monuments", "Stairs rising to a shrine platform.", 13, 11, 1, "stone_bricks", "moderate", ["monument"], []],
  ["memorial-plaza", "Memorial Plaza", "Temples & Monuments", "A paved plaza with a central pillar.", 13, 13, 1, "smooth_stone", "simple", ["monument"], []],
  ["warehouse", "Storage Warehouse", "Industry & Utility", "A flat-roofed shed with two loading openings.", 15, 9, 1, "gray_concrete", "simple", ["industry"], []],
  ["workshop", "Industrial Workshop", "Industry & Utility", "A shop floor with crafting benches.", 11, 8, 1, "spruce_planks", "simple", ["industry"], []],
  ["sawmill", "Lumber Sawmill", "Industry & Utility", "A timber shed, a log stack, and a wheel.", 13, 9, 1, "oak_planks", "moderate", ["industry"], ["The wheel does not turn or cut logs."]],
  ["railway-depot", "Railway Depot", "Industry & Utility", "A platform, a canopy, and one line of rail.", 15, 6, 1, "stone", "moderate", ["industry"], ["The rail is a placed block. It is not a working minecart route."]],
  ["silos", "Storage Silos", "Industry & Utility", "Three cylindrical bins.", 15, 9, 1, "white_terracotta", "moderate", ["industry"], []],
  ["pvp-arena", "PvP Arena", "Creative & Recreation", "An enclosed sand floor with two gates.", 13, 13, 1, "sand", "simple", ["recreation"], ["The enclosure is a build. It does not configure PvP rules."]],
  ["stadium", "Sports Stadium", "Creative & Recreation", "Tiered seating around a field.", 15, 15, 1, "stone", "large", ["recreation"], []],
  ["hedge-maze", "Hedge Maze", "Creative & Recreation", "Leaf walls with gaps that leave a walkable path.", 13, 13, 1, "oak_leaves", "moderate", ["recreation"], []],
  ["zen-garden", "Japanese Zen Garden", "Creative & Recreation", "Raked gravel, a pond, and a stone lantern.", 13, 11, 1, "gravel", "simple", ["garden"], []],
  ["fountain-plaza", "Grand Fountain Plaza", "Creative & Recreation", "A paved plaza with a central fountain.", 15, 15, 1, "stone_bricks", "moderate", ["monument"], ["The water is a placed source block, not a redstone fountain."]],
];

function specById(id) {
  return SPECS.find((row) => row[0] === id) || null;
}

function publicTemplate(row, sample) {
  const [id, name, category, description, width, depth, floors, material, complexity, tags, warnings] = row;
  return {
    id,
    name,
    category,
    description,
    generatorId: id,
    generatorVersion: GENERATOR_VERSION,
    defaults: { width, depth, floors, material, accent: "stone_bricks" },
    ranges: {
      width: [Math.max(7, width - 2), width + 4],
      depth: [Math.max(3, depth - 2), depth + 4],
      floors: floors > 1 ? [1, floors] : [1, 1],
    },
    complexity,
    tags,
    warnings,
    minecraft: "1.21",
    permissions: "The placing account must be allowed to build in the target world.",
    estimatedBlocks: sample.count,
    bounds: sample.bounds,
    supports: { rotate: true, mirror: true, floors: floors > 1, resize: true },
  };
}

export function generateTemplate(id, options = {}) {
  const row = specById(id);
  const builder = BUILDERS[id];
  if (!row || !builder) {
    const error = new Error(`Unknown structure template: ${id}`);
    error.code = "unknown_template";
    throw error;
  }
  const [, , , , defaultWidth, defaultDepth, defaultFloors, defaultMaterial] = row;
  const width = clamp(options.width, Math.max(7, defaultWidth - 2), defaultWidth + 4, defaultWidth);
  const depth = clamp(options.depth, Math.max(3, defaultDepth - 2), defaultDepth + 4, defaultDepth);
  const floors = clamp(options.floors, 1, defaultFloors > 1 ? defaultFloors : 1, defaultFloors);
  const material = typeof options.material === "string" && /^[a-z0-9_]+$/.test(options.material) ? options.material : defaultMaterial;
  let blocks = dedupe(builder({ w: width, d: depth, floors, material, accent: options.accent || "stone_bricks" }));
  const mirror = options.mirror === "x" || options.mirror === "z" ? options.mirror : null;
  if (mirror) blocks = dedupe(mirrorBlocks(blocks, mirror));
  const rotation = clamp(options.rotation, 0, 3, 0);
  if (rotation) blocks = dedupe(rotateBlocks(blocks, rotation));
  const bounds = boundsOf(blocks);
  return {
    templateId: id,
    generatorVersion: GENERATOR_VERSION,
    blocks,
    count: blocks.length,
    bounds,
    fingerprint: planFingerprint(blocks),
    warnings: row[10],
    settings: { width, depth, floors, material, accent: options.accent || "stone_bricks", rotation, mirror },
  };
}

let catalogCache = null;

export function listTemplates() {
  if (!catalogCache) {
    catalogCache = SPECS.map((row) => publicTemplate(row, generateTemplate(row[0])));
  }
  return catalogCache;
}

export function templateById(id) {
  return listTemplates().find((template) => template.id === id) || null;
}

const BLOCK_COLORS = {
  oak_planks: "#b8945f",
  spruce_planks: "#6f5130",
  dark_oak_planks: "#3f2a17",
  oak_log: "#6b542f",
  stripped_oak_log: "#c8ab74",
  stone: "#7d7d7d",
  stone_bricks: "#7a7a7a",
  cobblestone: "#6e6e6e",
  mossy_cobblestone: "#5d6b4a",
  deepslate_bricks: "#3c3c44",
  deepslate_tiles: "#33333b",
  quartz_block: "#ece8e0",
  smooth_quartz: "#f4f1ea",
  glass: "#b9e3ff",
  white_concrete: "#d0d0d0",
  gray_concrete: "#4e5154",
  sandstone: "#e0d1a1",
  bricks: "#8d4a3a",
  mud_bricks: "#8a6848",
  grass_block: "#5d8a32",
  dirt: "#6b4f2a",
  farmland: "#6a4324",
  water: "#3f76e4",
  sand: "#dbd3a0",
  gravel: "#847f7a",
  oak_leaves: "#2f6b22",
  hay_block: "#b89a2e",
  calcite: "#e6e2d8",
  amethyst_block: "#9a6bd6",
  white_terracotta: "#d1b1a1",
  green_concrete: "#4c7a3a",
  rail: "#6d5642",
  chain: "#8d9196",
};

function shade(hex, factor) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => Math.max(0, Math.min(255, Math.round(parseInt(value.slice(index, index + 2), 16) * factor))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function projectVoxel(x, y, z) {
  return { x: (x - z) * 14, y: (x + z) * 7 - y * 14 };
}

export function isometricPreview(blocks, width = 280, height = 200) {
  const solid = blocks.filter((block) => block.block !== "air");
  if (solid.length === 0) return { width, height, cells: [], faces: [] };
  const occupied = new Set(solid.map((block) => `${block.x}|${block.y}|${block.z}`));
  const bounds = boundsOf(solid);
  const heightSpan = Math.max(1, bounds.max.y - bounds.min.y);
  const faces = [];
  for (const block of solid) {
    const x = block.x - bounds.min.x;
    const y = block.y - bounds.min.y;
    const z = block.z - bounds.min.z;
    const baseColor = BLOCK_COLORS[block.block] || "#8ea0b8";
    const lift = 0.84 + 0.22 * (y / heightSpan);
    const color = shade(baseColor, lift);
    const worldX = block.x;
    const worldY = block.y;
    const worldZ = block.z;
    const top = projectVoxel(x, y + 1, z);
    const topX = projectVoxel(x + 1, y + 1, z);
    const topXZ = projectVoxel(x + 1, y + 1, z + 1);
    const topZ = projectVoxel(x, y + 1, z + 1);
    const base = projectVoxel(x, y, z);
    const baseX = projectVoxel(x + 1, y, z);
    const baseZ = projectVoxel(x, y, z + 1);
    const baseXZ = projectVoxel(x + 1, y, z + 1);
    if (!occupied.has(`${worldX}|${worldY + 1}|${worldZ}`)) {
      faces.push({ points: [top, topX, topXZ, topZ], color: shade(color, 1.28), depth: x + z + y + 2 });
    }
    if (!occupied.has(`${worldX + 1}|${worldY}|${worldZ}`)) {
      faces.push({ points: [topX, topXZ, baseXZ, baseX], color: shade(color, 0.74), depth: x + z + y + 0.4 });
    }
    if (!occupied.has(`${worldX}|${worldY}|${worldZ + 1}`)) {
      faces.push({ points: [topZ, topXZ, baseXZ, baseZ], color: shade(color, 0.48), depth: x + z + y });
    }
  }
  const xs = faces.flatMap((face) => face.points.map((point) => point.x));
  const ys = faces.flatMap((face) => face.points.map((point) => point.y));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = Math.max(16, width * 0.07);
  const padTop = Math.max(20, height * 0.16);
  const padBottom = Math.max(18, height * 0.1);
  const scale = Math.min((width - padX * 2) / Math.max(1, maxX - minX), (height - padTop - padBottom) / Math.max(1, maxY - minY));
  const drawnWidth = (maxX - minX) * scale;
  const originX = (width - drawnWidth) / 2;
  const drawn = faces
    .map((face) => ({
      ...face,
      points: face.points.map((point) => ({
        x: originX + (point.x - minX) * scale,
        y: padTop + (point.y - minY) * scale,
      })),
    }))
    .sort((left, right) => left.depth - right.depth);
  const cells = drawn.map((face) => {
    const cx = face.points.reduce((sum, point) => sum + point.x, 0) / face.points.length;
    const cy = face.points.reduce((sum, point) => sum + point.y, 0) / face.points.length;
    return { x: Math.round(cx), y: Math.round(cy), color: face.color, depth: face.depth };
  });
  return { width, height, cells, faces: drawn };
}
