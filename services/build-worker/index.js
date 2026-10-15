import os from "node:os";
import path from "node:path";
import { probeTcp } from "../cloud-api/src/app.js";
import { openCloudStore } from "../cloud-api/src/store.js";
import { advanceJob } from "../cloud-api/src/worker.js";

const dataDir = process.env.ZP_CLOUD_DATA || path.join(os.homedir(), ".zeropulse-cloud");
const pepper = process.env.CLOUD_PAIR_PEPPER || process.env.CLOUD_SERVER_TOKEN || "dev-pepper-not-for-production";
const store = openCloudStore(dataDir, pepper);
const host = process.env.MC_HOST || "";
const port = Number(process.env.MC_PORT || 25565);

async function tick() {
  await advanceJob(store, {
    probe: () => probeTcp(host, port),
    execute: null,
  });
}

setInterval(() => {
  tick().catch((error) => console.error("[build-worker]", error.message));
}, 2000);
console.log("[build-worker] waiting for queued jobs");
