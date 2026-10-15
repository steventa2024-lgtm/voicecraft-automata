import {
  architect,
  PALETTES,
  room,
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

export const SHOWCASE_DEFAULTS = {
  "starter-cottage": [13, 11],
  "oak-cabin": [15, 13],
  "lakeside-cottage": [17, 13],
  "forest-treehouse": [21, 19],
  "stone-keep": [25, 25],
  "cliffside-house": [19, 15],
  "glass-villa": [23, 19],
};
const palette = (style, o) => ({ ...PALETTES[style], wall: o.material, trim: o.accent });
export const SHOWCASE_BUILDERS = {
  "starter-cottage"(o) {
    const k = architect(),
      p = palette("cottage", o),
      w = o.w,
      d = o.d,
      c = Math.floor(w / 2);
    garden(k, -2, -1, -5, w + 4, d + 8, p);
    room(k, 0, 0, 0, w, d, 5, p);
    interior(k, 0, 0, 0, w, d, p);
    gableRoof(k, 0, 6, 0, w, d, p, { dormer: true });
    // Covered porch and two-wide path to the framed front door.
    deck(k, c - 3, 0, -3, 7, 3, p, { gateX: c });
    for (const x of [c - 3, c + 3]) k.box(x, 1, -3, 1, 3, 1, p.beam, { axis: "y" });
    gableRoof(k, c - 3, 4, -3, 7, 3, p);
    chimney(k, w - 3, 1, d - 3, 12, p);
    tree(k, -3, 0, d - 2, 8, 2);
    return k.finish();
  },
  "oak-cabin"(o) {
    const k = architect(),
      p = palette("rustic", o),
      w = o.w,
      d = o.d;
    garden(k, -2, -1, -5, w + 4, d + 8, p);
    room(k, 0, 0, 0, w, d, 5, p);
    interior(k, 0, 0, 0, w, d, p);
    // Log wall courses and exposed vertical bents, rather than a plank cube.
    for (let y = 1; y < 5; y += 2)
      for (let z = 1; z < d - 1; z++) k.put(0, y, z, "oak_log", { axis: "z" });
    for (let x = 3; x < w - 2; x += 4) k.box(x, 1, d - 1, 1, 4, 1, "oak_log", { axis: "y" });
    gableRoof(k, 0, 6, 0, w, d, p);
    deck(k, -2, 0, -4, w + 4, 4, p, { gateX: Math.floor(w / 2) });
    for (let x = -2; x <= w + 1; x += 4) k.box(x, 1, -4, 1, 3, 1, "oak_log", { axis: "y" });
    for (let z = -4; z < 0; z++) k.box(-2, 4, z, w + 4, 1, 1, "spruce_slab", slab("top"));
    chimney(k, w - 3, 1, d - 3, 13, p);
    tree(k, w + 3, 0, d - 1, 11, 3);
    return k.finish();
  },
  "lakeside-cottage"(o) {
    const k = architect(),
      p = palette("cottage", o),
      w = o.w,
      d = o.d;
    garden(k, -2, -1, -5, w + 4, d + 6, p);
    const wing = Math.max(7, Math.floor(w * 0.48));
    room(k, 0, 0, 0, wing, d, 5, p);
    interior(k, 0, 0, 0, wing, d, p);
    room(k, wing - 1, 0, 3, w - wing + 1, d - 3, 4, p, { entry: false });
    // Connect the two wings with an actual walkable opening.
    k.box(wing - 1, 1, 5, 1, 3, 2, "air");
    gableRoof(k, wing - 1, 5, 3, w - wing + 1, d - 3, p);
    gableRoof(k, 0, 6, 0, wing, d, p, { dormer: true });
    chimney(k, wing - 3, 1, d - 3, 12, p);
    deck(k, 1, 0, -3, wing - 2, 3, p, { gateX: Math.floor(wing / 2) });
    // Contained water court, with a narrow pier and wider landing; no spreading water marker.
    k.box(w + 1, -2, 3, 8, 1, d + 8, "stone_bricks");
    k.box(w + 1, -1, 3, 8, 1, d + 8, "stone_bricks");
    k.box(w + 2, -1, 4, 6, 1, d + 6, "water", { level: "0" });
    deck(k, w - 2, 0, d - 4, 6, 3, p, { rails: false });
    deck(k, w + 3, 0, d - 4, 3, 9, p, { rails: false });
    deck(k, w + 1, 0, d + 4, 7, 3, p, { rails: false });
    for (const [x, z] of [
      [w + 1, d + 4],
      [w + 7, d + 4],
      [w + 1, d + 6],
      [w + 7, d + 6],
    ]) {
      k.box(x, -2, z, 1, 4, 1, "spruce_log", { axis: "y" });
      k.put(x, 2, z, "lantern", { hanging: "false", waterlogged: "false" });
    }
    doorway(k, w - 1, 1, d - 3, "east", p); // side access onto the dock
    tree(k, -3, 0, d - 2, 10, 3);
    return k.finish();
  },
  "forest-treehouse"(o) {
    const k = architect(),
      p = palette("rustic", o),
      cx = Math.floor(o.w / 2),
      cz = Math.floor(o.d / 2);
    garden(k, 0, -1, 0, o.w, o.d, p);
    // A living central trunk passes through both decks; rooms wrap around it.
    deck(k, 2, 7, 2, o.w - 4, o.d - 4, p, { gateX: cx });
    room(k, 2, 7, 2, 7, 8, 4, p);
    gableRoof(k, 2, 12, 2, 7, 8, p);
    room(k, cx + 2, 10, cz - 3, o.w - cx - 4, 8, 4, p);
    gableRoof(k, cx + 2, 15, cz - 3, o.w - cx - 4, 8, p);
    deck(k, cx - 1, 10, cz + 3, 5, 5, p, { rails: false });
    stairway(k, cx + 4, 7, cz - 6, 2, 3, "south", p);
    // Broad trunk, exposed roots and branches carry the elevated architecture.
    k.box(cx - 1, 0, cz - 1, 3, 21, 3, "oak_log", { axis: "y" });
    for (let a = 0; a < 5; a++) {
      k.box(cx - 3 - a, Math.max(0, 2 - a), cz, 1, 1, 1, "oak_log", { axis: "x" });
      k.box(cx + 2 + a, 12 + a, cz, 1, 2, 1, "oak_log", { axis: "x" });
    }
    k.box(cx - 4, 14, cz + 2, 5, 1, 1, "oak_log", { axis: "x" });
    k.box(cx + 1, 17, cz + 1, 5, 1, 1, "oak_log", { axis: "x" });
    tree(k, cx - 4, 15, cz + 2, 6, 4);
    tree(k, cx + 5, 18, cz + 1, 5, 4);
    tree(k, cx, 20, cz, 5, 4);
    for (let y = 0; y <= 10; y++)
      k.put(cx, y, cz - 2, "ladder", { facing: "north", waterlogged: "false" });
    k.box(cx, 7, cz - 2, 1, 4, 1, "air");
    for (let y = 7; y <= 10; y++)
      k.put(cx, y, cz - 2, "ladder", { facing: "north", waterlogged: "false" });
    interior(k, 2, 7, 2, 7, 8, p);
    for (const [x, z] of [
      [2, 2],
      [o.w - 3, 2],
      [2, o.d - 3],
      [o.w - 3, o.d - 3],
    ])
      k.put(x, 9, z, "lantern", { hanging: "false", waterlogged: "false" });
    return k.finish();
  },
  "stone-keep"(o) {
    const k = architect(),
      p = palette("medieval", o),
      w = o.w,
      d = o.d,
      c = Math.floor(w / 2);
    k.box(-1, -1, -1, w + 2, 2, d + 2, "cobblestone");
    k.box(1, 0, 1, w - 2, 1, d - 2, "stone_bricks");
    // Curtain walls and continuous parapet walks enclose a courtyard.
    for (const z of [2, d - 3]) k.box(2, 1, z, w - 4, 7, 2, p.wall);
    for (const x of [2, w - 4]) k.box(x, 1, 2, 2, 7, d - 4, p.wall);
    for (let x = 2; x < w - 2; x += 2) for (const z of [2, d - 2]) k.put(x, 8, z, p.trim);
    for (let z = 2; z < d - 2; z += 2) for (const x of [2, w - 3]) k.put(x, 8, z, p.trim);
    // Main hall and upper solar have different footprints.
    const hw = w - 12,
      hd = d - 13;
    room(k, 6, 0, 8, hw, hd, 5, p);
    room(k, 7, 6, 9, hw - 2, hd - 2, 4, p);
    gableRoof(k, 7, 11, 9, hw - 2, hd - 2, p);
    interior(k, 6, 0, 8, hw, hd, p);
    stairway(k, 7, 0, 10, 2, 6, "south", p);
    for (const [x, z, h, roof] of [
      [3, 3, 12, true],
      [w - 4, 3, 14, true],
      [3, d - 4, 11, false],
      [w - 4, d - 4, 13, false],
    ])
      tower(k, x, 0, z, 3, h, p, { roof });
    // Three-wide, four-high gate, with a stone arch and raised portcullis.
    k.box(c - 1, 1, 1, 3, 4, 4, "air");
    k.put(c - 1, 5, 2, "stone_brick_stairs", stair("east", "top"));
    k.put(c + 1, 5, 2, "stone_brick_stairs", stair("west", "top"));
    k.box(c - 1, 6, 2, 3, 1, 1, "iron_bars");
    k.box(c - 1, 0, -3, 3, 1, 6, "stone_bricks");
    stairway(k, 4, 0, 5, 1, 7, "south", p);
    for (const x of [c - 2, c + 2]) {
      k.put(x, 2, 1, "stone_bricks");
      k.put(x, 3, 1, "lantern", { hanging: "false", waterlogged: "false" });
    }
    return k.finish();
  },
  "cliffside-house"(o) {
    const k = architect(),
      p = palette("cottage", o),
      w = o.w,
      d = o.d;
    // Terraced retaining foundation, a cantilevered balcony and two staggered volumes.
    for (let z = 0; z < d; z++)
      k.box(0, -2, z, w, Math.min(5, 2 + Math.floor(z / 3)), 1, z % 3 ? "stone" : "andesite");
    room(k, 1, 2, 3, w - 7, d - 4, 5, p);
    gableRoof(k, 1, 8, 3, w - 7, d - 4, p, { dormer: true });
    room(k, w - 8, 6, 5, 7, d - 6, 4, p);
    gableRoof(k, w - 8, 11, 5, 7, d - 6, p);
    deck(k, 0, 2, -1, w - 4, 4, p, { gateX: Math.floor((w - 7) / 2) + 1 });
    deck(k, w - 7, 6, 1, 7, 4, p, { gateX: w - 5 });
    stairway(k, w - 6, 0, -3, 2, 6, "south", p);
    interior(k, 1, 2, 3, w - 7, d - 4, p);
    interior(k, w - 8, 6, 5, 7, d - 6, p);
    chimney(k, 3, 3, d - 4, 14, p);
    tree(k, -3, -1, d - 2, 12, 3);
    return k.finish();
  },
  "glass-villa"(o) {
    const k = architect(),
      p = palette("modern", o),
      w = o.w,
      d = o.d;
    k.box(-2, -1, -3, w + 4, 2, d + 6, "smooth_quartz");
    const lw = Math.floor(w * 0.58);
    room(k, 0, 0, 2, lw, d - 3, 4, p, { glass: true });
    room(k, lw - 1, 0, 5, w - lw + 1, 8, 4, p, { glass: true });
    room(k, 2, 5, 4, lw - 2, d - 6, 4, p, { glass: true });
    // Interlocking horizontal roof planes and a recessed upper floor.
    k.box(-1, 5, 1, lw + 2, 1, d - 1, "smooth_quartz");
    k.box(1, 10, 3, lw, 1, d - 4, "smooth_quartz");
    k.box(lw - 1, 5, 4, w - lw + 2, 1, 10, "quartz_slab", slab("top"));
    k.box(lw - 1, 1, 7, 1, 3, 3, "air");
    stairway(k, 3, 0, 5, 2, 5, "south", p);
    // Balcony, vertical sun screens and a lined pool with contained sources.
    for (let x = 2; x < lw; x++) k.put(x, 6, 2, "glass_pane");
    for (let x = lw + 1; x < w; x += 2)
      k.box(x, 1, 5, 1, 4, 1, "stripped_birch_log", { axis: "y" });
    k.box(lw + 1, 0, d - 4, w - lw - 2, 1, 5, "quartz_block");
    k.box(lw + 2, 0, d - 3, w - lw - 4, 1, 3, "water", { level: "0" });
    k.box(lw + 2, -1, d - 3, w - lw - 4, 1, 3, "prismarine_bricks");
    for (let z = 3; z < d - 2; z += 3)
      k.put(-1, 1, z, "oak_leaves", { persistent: "true", waterlogged: "false" });
    interior(k, 0, 0, 2, lw, d - 3, p);
    k.put(lw - 2, 2, d - 1, "sea_lantern");
    return k.finish();
  },
};
