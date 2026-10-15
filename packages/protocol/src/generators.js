/** Voice/text commands use the same architectural components as the catalog. */
import { architect, PALETTES, room, gableRoof, stairway, interior } from "./architecture.js";
import { CATALOG_BUILDERS } from "./catalog-architecture.js";
function house(i) {
  const k = architect(),
    w = Math.max(9, i.dimensions.width),
    d = Math.max(9, i.dimensions.depth);
  const p = { ...PALETTES.cottage, wall: i.material };
  const floors = Math.max(1, Math.min(8, i.floors || 1));
  for (let f = 0; f < floors; f++) {
    room(k, 0, f * 5, 0, w, d, 4, p);
    interior(k, 0, f * 5, 0, w, d, p);
    if (f > 0) stairway(k, 1, (f - 1) * 5, 2, 2, 5, "south", p);
  }
  gableRoof(k, 0, floors * 5, 0, w, d, p, { dormer: true });
  return k.finish();
}
const recipe =
  (id, minW = 9, minD = 9) =>
  (i) =>
    CATALOG_BUILDERS[id]({
      w: Math.max(minW, i.dimensions.width),
      d: Math.max(minD, i.dimensions.depth),
      floors: Math.max(1, i.floors || 1),
      material: i.material,
      accent: "stone_bricks",
    });
export const GENERATORS = {
  house,
  mansion: recipe("luxury-mansion", 25, 19),
  tower: recipe("wizard-tower", 13, 13),
  castle: recipe("royal-castle", 31, 29),
  pyramid: recipe("desert-pyramid", 13, 13),
  bridge: recipe("stone-arch-bridge", 13, 5),
  wall: recipe("defensive-wall", 17, 7),
  farm: recipe("crop-farm", 13, 11),
  garden: recipe("botanical-garden", 17, 17),
  fountain: recipe("fountain-plaza", 17, 17),
  fortress: recipe("citadel", 31, 31),
  watchtower: recipe("mountain-watchtower", 13, 13),
};
export function generateStructure(instruction) {
  const gen = GENERATORS[instruction.structure];
  if (!gen) {
    const error = new Error("Unknown structure: " + instruction.structure);
    error.code = "unknown_structure";
    throw error;
  }
  return gen(instruction);
}
