import { blockCuboids, isOpaqueCube } from "./block-shapes.js";
import { boundsOf, rotateBlocks } from "./blueprint-edit.js";

import { COLORS, materialColor } from "./material-colors.js";
export { materialColor };
function shade(hex, factor) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * factor)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
const keyOf = (x, y, z) => `${x},${y},${z}`;
const project = (x, y, z) => ({ x: (x - z) * 0.866, y: (x + z) * 0.5 - y });
function path(points) {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("") + "Z";
}
function interpolate(points, u, v) {
  return {
    x: points[0].x + (points[1].x - points[0].x) * u + (points[3].x - points[0].x) * v,
    y: points[0].y + (points[1].y - points[0].y) * u + (points[3].y - points[0].y) * v,
  };
}

export function voxelScene(input, width = 360, height = 260, camera = 0, zoom = 1) {
  // Last write wins, including air. Never render cells removed by the canonical plan.
  const cells = new Map();
  for (const block of input) cells.set(keyOf(block.x, block.y, block.z), block);
  const solid = rotateBlocks(
    [...cells.values()].filter((b) => b.block !== "air"),
    camera,
  );
  if (!solid.length)
    return { paths: [], ground: "", grid: "", visibleBlocks: 0, faces: [], bounds: boundsOf([]) };
  const box = boundsOf(solid);
  const occupied = new Map(solid.map((b) => [keyOf(b.x, b.y, b.z), b]));
  const faces = [];
  for (const b of solid) {
    for (const [x0, y0, z0, x1, y1, z1] of blockCuboids(b)) {
      const vertices = [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ];
      const at = (i) => vertices[i].map((n, axis) => n + [b.x, b.y, b.z][axis]);
      const specs = [
        [[0, 1, 2, 3], [0, 1, 0], 1.12],
        [[1, 2, 6, 5], [1, 0, 0], 0.76],
        [[3, 2, 6, 7], [0, 0, 1], 0.92],
      ];
      specs.forEach(([indices, normal, light], side) => {
        const neighbor = occupied.get(keyOf(b.x + normal[0], b.y + normal[1], b.z + normal[2]));
        if (isOpaqueCube(b) && isOpaqueCube(neighbor)) return;
        const points3 = indices.map(at);
        const seed = Math.abs(((b.x * 73856093) ^ (b.y * 19349663) ^ (b.z * 83492791)) % 11);
        let color = materialColor(b.block);
        if (b.block === "grass_block" && side > 0) color = COLORS.dirt;
        if (/log/.test(b.block) && side === 0) color = "#be9762";
        const glow = /lantern|torch|glowstone/.test(b.block);
        faces.push({
          points: points3.map(([x, y, z]) => project(x, y, z)),
          depth: points3.reduce((sum, p) => sum + p[0] + p[1] + p[2], 0) / 4,
          color: shade(color, (glow ? 1 : light) * (0.95 + seed * 0.009)),
          id: b.block,
          side,
          seed,
        });
      });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  const gy = Math.min(0, box.min.y) - 0.12;
  const ground3 = [
    [box.min.x - 1, gy, box.min.z - 1],
    [box.max.x + 2, gy, box.min.z - 1],
    [box.max.x + 2, gy, box.max.z + 2],
    [box.min.x - 1, gy, box.max.z + 2],
  ];
  const ground = ground3.map(([x, y, z]) => project(x, y, z));
  const all = [...faces.flatMap((f) => f.points), ...ground];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of all) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const scale =
    Math.max(
      0.01,
      Math.min(
        (width - Math.min(28, width * 0.08)) / (maxX - minX),
        (height - Math.min(30, height * 0.14)) / (maxY - minY),
      ),
    ) * zoom;
  const transform = (p) => ({
    x: width / 2 + (p.x - (minX + maxX) / 2) * scale,
    y: height / 2 + 5 + (p.y - (minY + maxY) / 2) * scale,
  });
  const paths = [];
  function add(points, color) {
    const d = path(points.map(transform));
    const previous = paths[paths.length - 1];
    if (previous?.color === color) previous.d += d;
    else paths.push({ color, d });
  }
  for (const face of faces) {
    add(face.points, face.color + (/glass/.test(face.id) ? "aa" : ""));
    if (width < 180) continue;
    // Texture is anchored to the block, not the camera or screen, and never changes geometry.
    const wood = /planks|log|wood|crafting/.test(face.id);
    const glass = /glass|water/.test(face.id);
    const rows = width < 500 ? 1 : wood ? 3 : 2;
    for (let v = 0; v < rows; v++) {
      for (let u = 0; u < (wood || width < 500 ? 1 : 2); u++) {
        const cols = wood || width < 500 ? 1 : 2;
        const x0 = u / cols + 0.035,
          x1 = (u + 1) / cols - 0.035,
          y0 = v / rows + 0.035,
          y1 = (v + 1) / rows - 0.035;
        const variation = glass ? 1.08 : 0.94 + ((face.seed + u * 3 + v * 7) % 5) * 0.025;
        add(
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ].map(([x, y]) => interpolate(face.points, x, y)),
          shade(face.color, variation),
        );
      }
    }
    if (face.id === "grass_block" && face.side > 0)
      add(
        [
          [0, 0],
          [1, 0],
          [1, 0.22],
          [0, 0.22],
        ].map(([u, v]) => interpolate(face.points, u, v)),
        COLORS.grass,
      );
  }
  let grid = "";
  for (let x = box.min.x - 1; x <= box.max.x + 2; x += 2) {
    const a = transform(project(x, gy, box.min.z - 1)),
      b = transform(project(x, gy, box.max.z + 2));
    grid += `M${a.x},${a.y}L${b.x},${b.y}`;
  }
  for (let z = box.min.z - 1; z <= box.max.z + 2; z += 2) {
    const a = transform(project(box.min.x - 1, gy, z)),
      b = transform(project(box.max.x + 2, gy, z));
    grid += `M${a.x},${a.y}L${b.x},${b.y}`;
  }
  return {
    paths,
    faces: faces.map((f) => ({ ...f, points: f.points.map(transform) })),
    ground: path(ground.map(transform)),
    grid,
    visibleBlocks: solid.length,
    bounds: box,
  };
}

export function sceneSvg(blocks, width = 480, height = 360, camera = 2) {
  const scene = voxelScene(blocks, width, height, camera);
  return sceneMarkup(scene, width, height);
}
export function sceneMarkup(scene, width, height, grid = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><radialGradient id="bg"><stop stop-color="#214c69"/><stop offset="1" stop-color="#071426"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><path d="${scene.ground}" fill="#102d36" stroke="#285169"/><path d="${grid ? scene.grid : ""}" fill="none" stroke="#315061" stroke-width=".5"/>${scene.paths.map((p) => `<path fill="${p.color}" d="${p.d}"/>`).join("")}</svg>`;
}
