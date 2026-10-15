import os from "node:os";
import path from "node:path";
import { probeTcp } from "../cloud-api/src/app.js";
import { openCloudStore } from "../cloud-api/src/store.js";
import { advanceJob } from "../cloud-api/src/worker.js";
import { createMinecraftExecutor } from "./executor.js";

const dataDir = process.env.ZP_CLOUD_DATA || path.join(os.homedir(), ".zeropulse-cloud");
const pepper = process.env.CLOUD_PAIR_PEPPER || process.env.CLOUD_SERVER_TOKEN || "dev-pepper-not-for-production";
const store = openCloudStore(dataDir, pepper);
const host = process.env.MC_HOST || "";
const port = Number(process.env.MC_PORT || 25565);
const site = process.env.VOICECRAFT_SITE_URL || "";
const executor = host
  ? createMinecraftExecutor({
      host,
      port,
      username: process.env.MC_USERNAME || "VoiceCraft",
      version: process.env.MC_VERSION || false,
      worldId: process.env.WORLD_ID || "public-build",
      store,
    })
  : { execute: null };

async function releaseRemote(token, requestedBlocks, placed) {
  if (!site || !token) return;
  const response = await fetch(new URL("/api/builder/release", site), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-zeropulse-runner-token": token,
    },
    body: JSON.stringify({ requestedBlocks, placed }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    console.error("[build-worker] reservation release failed");
  }
}

async function tick() {
  await advanceJob(store, {
    probe: () => probeTcp(host, port),
    execute: executor.execute ? (payload) => executor.execute(payload) : null,
    releaseRemote: site ? releaseRemote : null,
  });
}

setInterval(() => {
  tick().catch((error) => console.error("[build-worker]", error.message));
}, 2000);
console.log("[build-worker] waiting for queued jobs");
