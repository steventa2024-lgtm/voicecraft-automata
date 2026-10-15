import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { createApp, defaultPlanner, supabaseUser } from "./app.js";
import { HttpError } from "./errors.js";
import { openCloudStore } from "./store.js";
import { advanceJob } from "./worker.js";
import { probeTcp } from "./app.js";

const dataDir = process.env.ZP_CLOUD_DATA || path.join(os.homedir(), ".zeropulse-cloud");
const pepper = process.env.CLOUD_PAIR_PEPPER || process.env.CLOUD_SERVER_TOKEN || "dev-pepper-not-for-production";
const store = openCloudStore(dataDir, pepper);
const host = process.env.MC_HOST || "";
const port = Number(process.env.MC_PORT || 25565);
const site = process.env.VOICECRAFT_SITE_URL || "";

async function remoteProfile(_user, token) {
  const response = await fetch(new URL("/api/account/me", site), {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status || 503, body.message || "Account status is unavailable.");
  return { profile: body.profile, usage: body.usage || { task_count: 0, block_count: 0 } };
}

async function reserveRemote(token, requestedBlocks) {
  const issued = await fetch(new URL("/api/builder/token", site), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });
  const ticket = await issued.json().catch(() => ({}));
  if (!issued.ok || !ticket.token) {
    throw new HttpError(issued.status || 402, ticket.message || "Could not reserve build allowance.");
  }
  const verified = await fetch(new URL("/api/builder/verify-run", site), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-zeropulse-runner-token": ticket.token,
    },
    body: JSON.stringify({ requestedBlocks }),
    signal: AbortSignal.timeout(8_000),
  });
  const decision = await verified.json().catch(() => ({}));
  if (!verified.ok || decision.allowed === false) {
    throw new HttpError(402, decision.message || "Subscription limit reached.");
  }
}

const app = createApp({
  store,
  serverToken: process.env.CLOUD_SERVER_TOKEN || "",
  allowLocalAccounts: process.env.CLOUD_LOCAL_ACCOUNTS === "1",
  authenticate: supabaseUser,
  fetchProfile: site ? remoteProfile : null,
  reserveRemote: site ? reserveRemote : null,
  minecraftHost: host,
  minecraftPort: port,
  geyserHost: process.env.GEYSER_HOST || host,
  geyserPort: Number(process.env.GEYSER_PORT || 19132),
  publicHost: process.env.PUBLIC_BEDROCK_HOST || "",
  publicPort: Number(process.env.PUBLIC_BEDROCK_PORT || 19132),
  planner: process.env.OLLAMA_URL ? defaultPlanner : null,
});

const server = createServer(async (incoming, outgoing) => {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://${incoming.headers.host || "127.0.0.1"}${incoming.url}`, {
    method: incoming.method,
    headers: incoming.headers,
    body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : body,
  });
  const response = await app(request);
  const payload = Buffer.from(await response.arrayBuffer());
  outgoing.writeHead(response.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  outgoing.end(payload);
});

const bind = process.env.CLOUD_BIND || "127.0.0.1";
const listenPort = Number(process.env.PORT || 8787);
server.listen(listenPort, bind, () => {
  console.log(`[cloud-api] listening on http://${bind}:${listenPort}`);
});

if (process.env.CLOUD_EMBED_WORKER === "1") {
  setInterval(() => {
    advanceJob(store, {
      probe: () => probeTcp(host, port),
      execute: null,
    }).catch((error) => console.error("[cloud-worker]", error.message));
  }, 2000).unref();
}
