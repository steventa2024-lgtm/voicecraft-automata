/** Shared Java block geometry. Cuboids use block-local coordinates; both viewers consume this. */
const cube = [0, 0, 0, 1, 1, 1];
const turns = { north: 0, east: 1, south: 2, west: 3 };
function oriented(parts, facing) {
  return parts.map((part) => {
    let [x, y, z, X, Y, Z] = part;
    for (let i = 0; i < (turns[facing] || 0); i++) [x, z, X, Z] = [1 - Z, x, 1 - z, X];
    return [x, y, z, X, Y, Z];
  });
}
export function blockCuboids({ block: id, states: s = {} }) {
  if (/^(air|cave_air|void_air)$/.test(id)) return [];
  if (id.endsWith("_stairs")) {
    const top = s.half === "top",
      y = top ? 0 : 0.5,
      Y = top ? 0.5 : 1;
    let step = [0, y, 0, 1, Y, 0.5];
    if (s.shape?.startsWith("outer"))
      step = s.shape.endsWith("left") ? [0, y, 0, 0.5, Y, 0.5] : [0.5, y, 0, 1, Y, 0.5];
    const parts = [[0, top ? 0.5 : 0, 0, 1, top ? 1 : 0.5, 1], step];
    if (s.shape?.startsWith("inner"))
      parts.push(s.shape.endsWith("left") ? [0, y, 0.5, 0.5, Y, 1] : [0.5, y, 0.5, 1, Y, 1]);
    return oriented(parts, s.facing);
  }
  if (id.endsWith("_slab"))
    return [
      s.type === "double"
        ? cube
        : [0, s.type === "top" ? 0.5 : 0, 0, 1, s.type === "top" ? 1 : 0.5, 1],
    ];
  if (id.endsWith("_trapdoor"))
    return oriented(
      [
        s.open === "true"
          ? [0, 0, 13 / 16, 1, 1, 1]
          : [0, s.half === "top" ? 13 / 16 : 0, 0, 1, s.half === "top" ? 1 : 3 / 16, 1],
      ],
      s.facing,
    );
  if (id.endsWith("_door")) {
    const face =
      s.open === "true"
        ? Object.keys(turns)[((turns[s.facing] || 0) + (s.hinge === "right" ? 3 : 1)) % 4]
        : s.facing;
    return oriented([[0, 0, 0, 1, 1, 3 / 16]], face);
  }
  if (id.endsWith("_fence")) {
    const parts = [[0.375, 0, 0.375, 0.625, 1, 0.625]];
    for (const dir of Object.keys(turns))
      if (s[dir] === "true")
        parts.push(
          ...oriented(
            [
              [0.4375, 0.375, 0, 0.5625, 0.5625, 0.5],
              [0.4375, 0.75, 0, 0.5625, 0.9375, 0.5],
            ],
            dir,
          ),
        );
    return parts;
  }
  if (id.endsWith("_wall")) {
    const parts = s.up === "false" ? [] : [[0.25, 0, 0.25, 0.75, 1, 0.75]];
    for (const dir of Object.keys(turns))
      if (s[dir] && s[dir] !== "none")
        parts.push(...oriented([[0.3125, 0, 0, 0.6875, s[dir] === "tall" ? 1 : 0.875, 0.5]], dir));
    return parts.length ? parts : [[0.25, 0, 0.25, 0.75, 1, 0.75]];
  }
  if (id.includes("anvil"))
    return oriented(
      [
        [0.125, 0, 0.125, 0.875, 0.25, 0.875],
        [0.25, 0.25, 0.375, 0.75, 0.625, 0.625],
        [0, 0.625, 0.1875, 1, 1, 0.8125],
      ],
      s.facing,
    );
  if (id.endsWith("_pane") || id === "iron_bars") {
    const parts = [[0.4375, 0, 0.4375, 0.5625, 1, 0.5625]];
    for (const dir of Object.keys(turns))
      if (s[dir] === "true") parts.push(...oriented([[0.4375, 0, 0, 0.5625, 1, 0.5]], dir));
    return parts;
  }
  if (id === "ladder") {
    const parts = [
      [0.125, 0, 0.875, 0.25, 1, 1],
      [0.75, 0, 0.875, 0.875, 1, 1],
    ];
    for (let y = 0.0625; y < 1; y += 0.25) parts.push([0.125, y, 0.875, 0.875, y + 0.125, 1]);
    return oriented(parts, s.facing);
  }
  if (id.endsWith("lantern"))
    return [
      [
        0.3125,
        s.hanging === "true" ? 0.125 : 0,
        0.3125,
        0.6875,
        s.hanging === "true" ? 0.5625 : 0.4375,
        0.6875,
      ],
      [0.4375, 0.4375, 0.4375, 0.5625, s.hanging === "true" ? 1 : 0.5625, 0.5625],
    ];
  if (id === "chain")
    return [
      s.axis === "x"
        ? [0, 0.4375, 0.4375, 1, 0.5625, 0.5625]
        : s.axis === "z"
          ? [0.4375, 0.4375, 0, 0.5625, 0.5625, 1]
          : [0.4375, 0, 0.4375, 0.5625, 1, 0.5625],
    ];
  if (id.includes("campfire"))
    return [
      [0, 0, 0.125, 1, 0.25, 0.375],
      [0, 0, 0.625, 1, 0.25, 0.875],
      [0.125, 0.25, 0, 0.375, 0.4375, 1],
      [0.625, 0.25, 0, 0.875, 0.4375, 1],
    ];
  if (id.includes("torch")) return [[0.4375, 0, 0.4375, 0.5625, 0.625, 0.5625]];
  if (id.includes("pressure_plate")) return [[0.0625, 0, 0.0625, 0.9375, 0.0625, 0.9375]];
  if (id.endsWith("carpet") || id.includes("rail")) return [[0, 0, 0, 1, 0.0625, 1]];
  if (id === "water") return [[0, 0, 0, 1, Math.max(0.125, 1 - Number(s.level || 0) / 8), 1]];
  if (id === "farmland" || id === "dirt_path") return [[0, 0, 0, 1, 0.9375, 1]];
  if (/wheat|poppy|dandelion|fern|short_grass/.test(id))
    return [
      [0.125, 0, 0.46875, 0.875, 0.875, 0.53125],
      [0.46875, 0, 0.125, 0.53125, 0.875, 0.875],
    ];
  return [cube];
}
export function isOpaqueCube(block) {
  if (!block || /glass|water|leaves|ice/.test(block.block)) return false;
  const parts = blockCuboids(block);
  return parts.length === 1 && parts[0].every((v, i) => v === cube[i]);
}
