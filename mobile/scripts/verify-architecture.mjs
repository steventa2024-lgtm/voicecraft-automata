import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { generateTemplate, listTemplates } from "../../packages/protocol/src/templates.js";
import { SHOWCASE_DEFAULTS } from "../../packages/protocol/src/showcase.js";
import { sceneSvg } from "../src/lib/voxel-scene.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "docs/architecture-verification");
await fs.mkdir(dir, { recursive: true });
const report = [];
for (const id of Object.keys(SHOWCASE_DEFAULTS)) {
  const before = JSON.parse(await fs.readFile(path.join(dir, `${id}-before.json`), "utf8"));
  const plan = generateTemplate(id);
  await fs.writeFile(path.join(dir, `${id}-after.json`), JSON.stringify(plan));
  await sharp(Buffer.from(sceneSvg(plan.blocks, 900, 700, 2)))
    .png()
    .toFile(path.join(dir, `${id}-after.png`));
  await sharp({ create: { width: 1800, height: 700, channels: 4, background: "#071426" } })
    .composite([
      { input: path.join(dir, `${id}-before.png`), left: 0, top: 0 },
      { input: path.join(dir, `${id}-after.png`), left: 900, top: 0 },
    ])
    .png()
    .toFile(path.join(dir, `${id}-comparison.png`));
  const counts = (p) => ({
    operations: p.count,
    solid: p.blocks.filter((b) => b.block !== "air").length,
    materials: new Set(p.blocks.filter((b) => b.block !== "air").map((b) => b.block)).size,
    stateful: p.blocks.filter((b) => b.states).length,
    bounds: p.bounds,
    fingerprint: p.fingerprint,
  });
  report.push({
    id,
    name: listTemplates().find((t) => t.id === id).name,
    before: counts(before),
    after: counts(plan),
  });
}
await fs.writeFile(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
await fs.writeFile(
  path.join(dir, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VoiceCraft architectural verification</title><style>body{background:#071426;color:#e5edff;font:16px system-ui;max-width:1500px;margin:auto;padding:32px}h1{color:#49baff}section{margin:40px 0;border:1px solid #284963;border-radius:16px;padding:20px}img{width:100%}p{color:#a5bed3}.labels{display:flex;justify-content:space-around}a{color:#49baff}code{color:#5de4b0}</style><h1>Executable architecture: before / after</h1><p><a href="catalog-1.png">Catalog 1–25</a> · <a href="catalog-2.png">Catalog 26–50</a> · <a href="desktop-lakeside.png">Running desktop renderer</a> · <a href="running-interior.png">Mobile interior inspection</a></p><p>Original generator 1 plans captured at commit 22b584d. Generator 2 previews use the actual canonical cells and block states. Both images are fitted independently to show architectural detail. Procedural textures; no concept art. Java Edition 1.21.1. Live Minecraft placement remains unverified: no compatible local server was available.</p>${report.map((r) => `<section><h2>${r.name}</h2><div class="labels"><span>Before: ${r.before.solid} solid blocks</span><span>After: ${r.after.solid} solid blocks</span></div><img src="${r.id}-comparison.png" alt="${r.name}: original and enhanced executable plans"><p>${r.before.operations} → ${r.after.operations} operations · ${r.after.materials} materials · ${r.after.stateful} oriented/property-bearing cells · fingerprint <code>${r.after.fingerprint}</code></p><a href="${r.id}-before.json">Original canonical plan</a> · <a href="${r.id}-after.json">Enhanced canonical plan</a> · <a href="running-${r.id}.png">Running mobile editor</a></section>`).join("")}</html>`,
);
console.table(
  report.map((r) => ({
    id: r.id,
    before: r.before.solid,
    after: r.after.solid,
    operations: r.after.operations,
    materials: r.after.materials,
  })),
);

const templates=listTemplates();
await fs.writeFile(path.join(dir,'catalog-manifest.json'),JSON.stringify(templates.map(t=>{const p=generateTemplate(t.id);return {id:t.id,operations:p.count,solid:p.blocks.filter(b=>b.block!=='air').length,bounds:p.bounds,fingerprint:p.fingerprint};}),null,2));
for(let sheet=0;sheet<2;sheet++) {
 const composites=[];
 for(let n=0;n<25;n++) {
  const t=templates[sheet*25+n],left=n%5*300,top=Math.floor(n/5)*240;
  composites.push({input:await sharp(path.join(root,'mobile/assets/catalog',t.id+'.png')).resize(300,210).toBuffer(),left,top});
  const label='<svg width="300" height="30"><rect width="300" height="30" fill="#071426"/><text x="10" y="20" fill="#cde6ff" font-size="12" font-family="Arial">'+t.name.replaceAll('&','&amp;')+'</text></svg>';
  composites.push({input:Buffer.from(label),left,top:top+210});
 }
 await sharp({create:{width:1500,height:1200,channels:4,background:'#071426'}}).composite(composites).png().toFile(path.join(dir,'catalog-'+(sheet+1)+'.png'));
}
