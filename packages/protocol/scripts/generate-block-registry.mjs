import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const require=createRequire(new URL("../../../bridge/package.json",import.meta.url));
const data=require("minecraft-data")("1.21.1");
if(data.version.minecraftVersion!=="1.21.1")throw new Error("Exact target registry unavailable.");
const registry=Object.fromEntries(data.blocksArray.map(block=>[block.name,Object.fromEntries(block.states.map(state=>[
  state.name,state.values||(state.type==="bool"?["true","false"]:Array.from({length:state.num_values},(_,i)=>String(i))),
]))]));
await writeFile(new URL("../src/block-registry.js",import.meta.url),`// Java Edition 1.21.1 block properties from minecraft-data (MIT). No game textures.\nexport const TARGET_MINECRAFT = "1.21.1";\nexport const BLOCK_REGISTRY = ${JSON.stringify(registry)};\n`);
