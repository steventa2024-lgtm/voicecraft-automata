import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { generateTemplate, listTemplates } from "../../packages/protocol/src/templates.js";
import { sceneSvg } from "../src/lib/voxel-scene.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await fs.mkdir(path.join(root, "assets/catalog"), { recursive: true });
const lines = [];
for (const template of listTemplates()) {
  const plan = generateTemplate(template.id);
  await sharp(Buffer.from(sceneSvg(plan.blocks, 560, 400, 2)))
    .png()
    .toFile(path.join(root, "assets/catalog", template.id + ".png"));
  lines.push('  "' + template.id + '": require("../assets/catalog/' + template.id + '.png"),');
}
await fs.writeFile(
  path.join(root, "src/thumbnails.ts"),
  '// Generated from canonical plans by npm run thumbnails. No concept art.\nimport type { ImageSourcePropType } from "react-native";\nexport const thumbnails: Record<string,ImageSourcePropType> = {\n' +
    lines.join("\n") +
    "\n};\n",
);
console.log("Generated " + lines.length + " plan-derived thumbnails.");
