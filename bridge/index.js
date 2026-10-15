/**
 * ZeroPulse bridge.
 * Local desktop clients authenticate over a loopback WebSocket.
 * Minecraft builds do not start until the desktop approves a preview and the
 * server accepts a runner token.
 */
import "dotenv/config";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { WebSocketServer } from "ws";
import { Vec3 } from "vec3";
import mineflayer from "mineflayer";
import { detectMode, placeBlocks } from "./placer.js";
import { createBridgeRuntime } from "./runtime.js";
import { startRelay } from "./relay.js";
import { openStore } from "./store.js";
import { evaluateChatCommand, parseCommand, worldPosition } from "../packages/protocol/src/index.js";

const HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.BRIDGE_PORT || 8765);
const AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || "";
const MC_HOST = process.env.MC_HOST || "localhost";
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_USERNAME = process.env.MC_USERNAME || "ZeroPulse";
const MC_VERSION = process.env.MC_VERSION || undefined;
const API_URL = (process.env.ZP_API_URL || "").replace(/\/$/, "");

if (!AUTH_TOKEN || AUTH_TOKEN.length < 24) {
  console.error("[zeropulse] BRIDGE_AUTH_TOKEN must be set to at least 24 characters. The bridge will not listen.");
  process.exit(1);
}
if (HOST !== "127.0.0.1" && HOST !== "localhost" && HOST !== "::1" && process.env.BRIDGE_ALLOW_LAN !== "1") {
  console.error("[zeropulse] Refusing to bind a non-loopback host without BRIDGE_ALLOW_LAN=1.");
  process.exit(1);
}

const dataDir = process.env.ZP_DATA_DIR || path.join(os.homedir(), ".zeropulse");
const store = openStore(dataDir);
let bot = null;
let botReady = false;
let placementMode = null;
let reconnectDelay = 5_000;
let reconnectTimer = null;
const devices = new Map();

function worldKey() {
  return `${MC_HOST}:${MC_PORT}:${bot?.game?.dimension || "overworld"}`;
}

async function authorize({ requestedBlocks, runnerToken }) {
  if (!API_URL) {
    return { allowed: false, message: "ZP_API_URL is not configured. Builds stay blocked so subscription limits cannot be skipped offline." };
  }
  if (!runnerToken) return { allowed: false, message: "Missing build authorization." };
  try {
    const response = await fetch(`${API_URL}/api/builder/verify-run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-zeropulse-runner-token": runnerToken,
      },
      body: JSON.stringify({ requestedBlocks }),
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.allowed === false) {
      return { allowed: false, message: body.message || "The account cannot start this build." };
    }
    return { allowed: true, ...body };
  } catch (error) {
    return { allowed: false, message: `Entitlement check failed: ${error.message}` };
  }
}

async function release({ requestedBlocks, runnerToken }) {
  if (!API_URL || !runnerToken) return;
  await fetch(`${API_URL}/api/builder/release`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-zeropulse-runner-token": runnerToken,
    },
    body: JSON.stringify({ requestedBlocks, placed: 0 }),
    signal: AbortSignal.timeout(12_000),
  }).catch(() => {});
}

const runtime = createBridgeRuntime({
  authToken: AUTH_TOKEN,
  allowLan: process.env.BRIDGE_ALLOW_LAN === "1",
  get botReady() {
    return botReady;
  },
  onEvent(event) {
    broadcast(event);
  },
  getPlayer() {
    if (!bot?.entity) return { x: 0, y: 64, z: 0, yaw: 0 };
    const position = bot.entity.position.floored();
    return { x: position.x, y: position.y, z: position.z, yaw: bot.entity.yaw };
  },
  sampleBlock(x, y, z) {
    return bot?.blockAt?.(new Vec3(x, y, z))?.name ?? null;
  },
  authorize,
  release,
  async place({ instruction, plan, origin, job, onProgress }) {
    if (!botReady || !bot) throw new Error("Bot is not in the world yet.");
    const worldBlocks = plan.blocks.map((block) =>
      worldPosition(origin, block, instruction.rotation || 0, instruction.dimensions.width, instruction.dimensions.depth),
    );
    const startedAt = new Date().toISOString();
    const snapshot = [];
    for (const block of worldBlocks.slice(0, 20_000)) {
      if (job.cancelled) break;
      const current = bot.blockAt(new Vec3(block.x, block.y, block.z));
      snapshot.push({ x: block.x, y: block.y, z: block.z, before: current?.name || "air", after: block.block });
    }
    const result = await placeBlocks(bot, worldBlocks, null, job, onProgress, placementMode);
    store.recordBuild(
      {
        worldKey: worldKey(),
        action: instruction.action,
        structure: instruction.structure,
        material: instruction.material,
        status: job.cancelled ? "cancelled" : result.status || "completed",
        origin,
        blockCount: plan.count,
        placed: result.placed,
        failed: result.failed,
        startedAt,
        note: snapshot.length === worldBlocks.length ? null : "Undo covers the first 20,000 blocks only.",
      },
      snapshot.length === worldBlocks.length ? snapshot : [],
    );
    return result;
  },
  async undo(runnerToken) {
    const prepared = store.prepareUndo(worldKey(), (change) => bot?.blockAt?.(new Vec3(change.x, change.y, change.z))?.name);
    if (!prepared.available) {
      broadcast({ type: "error", message: prepared.reason });
      return { ok: false };
    }
    const decision = await authorize({ requestedBlocks: Math.max(1, prepared.operations.length), runnerToken });
    if (!decision.allowed) {
      broadcast({ type: "error", message: decision.message });
      return { ok: false };
    }
    broadcast({ type: "status", status: "building", message: `Undoing ${prepared.operations.length} blocks` });
    const job = { cancelled: false, paused: false };
    const result = await placeBlocks(bot, prepared.operations, null, job, null, placementMode);
    broadcast({ type: "status", status: result.status, message: "Undo finished", result });
    return { ok: true, result };
  },
  async redo(runnerToken) {
    const prepared = store.prepareRedo(worldKey(), (change) => bot?.blockAt?.(new Vec3(change.x, change.y, change.z))?.name);
    if (!prepared.available) {
      broadcast({ type: "error", message: prepared.reason || "Redo is unavailable." });
      return { ok: false };
    }
    const decision = await authorize({ requestedBlocks: Math.max(1, prepared.operations.length), runnerToken });
    if (!decision.allowed) {
      broadcast({ type: "error", message: decision.message });
      return { ok: false };
    }
    const result = await placeBlocks(bot, prepared.operations, null, { cancelled: false, paused: false }, null, placementMode);
    broadcast({ type: "status", status: result.status, message: "Redo finished", result });
    return { ok: true, result };
  },
});

const clients = new Set();
function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1 && ws.authenticated) ws.send(message);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
}

function createBot() {
  console.log(`[zeropulse] connecting to ${MC_HOST}:${MC_PORT} as ${MC_USERNAME}`);
  bot = mineflayer.createBot({
    host: MC_HOST,
    port: MC_PORT,
    username: MC_USERNAME,
    version: MC_VERSION,
    auth: process.env.MC_AUTH || "offline",
    hideErrors: true,
  });
  bot.once("spawn", async () => {
    botReady = true;
    reconnectDelay = 5_000;
    broadcast({ type: "status", status: "connected", message: "Bot spawned." });
    try {
      placementMode = await detectMode(bot);
    } catch (error) {
      placementMode = "creative";
      broadcast({ type: "log", message: `Placement probe failed: ${error.message}` });
    }
    const creative = bot.game?.gameMode === "creative";
    broadcast({
      type: "mode",
      mode: placementMode,
      gameMode: bot.game?.gameMode || "unknown",
      message:
        placementMode === "command"
          ? "Operator command placement is available."
          : creative
            ? "Creative hand placement is available. Farms and water features are less exact in this mode."
            : "Survival placement is not available. Enable cheats or switch the bot to Creative.",
    });
  });
  bot.on("kicked", (reason) => {
    botReady = false;
    broadcast({ type: "error", message: `Kicked: ${reason}` });
  });
  bot.on("error", (error) => {
    botReady = false;
    broadcast({ type: "error", message: `Bot error: ${error.message}` });
  });
  bot.on("end", () => {
    botReady = false;
    broadcast({ type: "status", status: "idle", message: `Bot disconnected. Retrying in ${Math.round(reconnectDelay / 1000)}s.` });
    scheduleReconnect();
  });
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;
    if (!/^(zp|zeropulse)\b/i.test(message)) return;
    const policy = evaluateChatCommand({
      enabled: process.env.MC_CHAT_CONTROL === "1",
      username,
      allowlist: (process.env.MC_CHAT_ALLOW || "").split(","),
      authMode: process.env.MC_AUTH || "offline",
      trustOffline: process.env.MC_CHAT_TRUST_OFFLINE === "1",
      action: "build",
    });
    if (!policy.allowed) {
      broadcast({ type: "log", message: `Ignored in-game command from ${username} (${policy.reason}).` });
      return;
    }
    const instruction = parseCommand(message.replace(/^(zp|zeropulse)\b/i, ""));
    if (instruction.action === "build" || instruction.action === "clear" || instruction.action === "undo" || instruction.action === "redo") {
      broadcast({ type: "log", message: "In-game chat cannot approve destructive actions. Confirm them in the desktop app." });
      return;
    }
    runtime.handleMessage({ authenticated: true }, { type: "command", instruction });
  });
}

const server = http.createServer((_req, res) => {
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
server.listen(PORT, HOST, () => {
  console.log(`[zeropulse] authenticated bridge listening on ws://${HOST}:${PORT}`);
});

wss.on("connection", (ws, request) => {
  const remote = request.socket.remoteAddress || "";
  const accepted = runtime.acceptConnection(remote, request.headers.origin);
  if (!accepted.ok) {
    ws.close(1008, "unauthorized");
    return;
  }
  ws.authenticated = false;
  const timeout = setTimeout(() => {
    if (!ws.authenticated) ws.close(1008, "auth timeout");
  }, runtime.authTimeoutMs);
  ws.on("message", async (data) => {
    const assessed = runtime.assessMessage(data.toString());
    if (!assessed.ok) {
      ws.close(1009, "payload too large");
      return;
    }
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      return;
    }
    const result = await runtime.handleMessage(ws, payload);
    if (result?.close) ws.close(1008, "unauthorized");
    if (ws.authenticated) clients.add(ws);
  });
  ws.on("close", () => {
    clearTimeout(timeout);
    clients.delete(ws);
  });
});

const relay = process.env.ZP_PAIR_CODE
  ? startRelay({
      code: process.env.ZP_PAIR_CODE,
      isDeviceApproved: (deviceId) => devices.get(deviceId)?.revoked !== true,
      onPairRequest(request) {
        broadcast({ type: "pair-request", request });
      },
      onProposal(proposal) {
        broadcast({
          type: "remote-proposal",
          proposal: {
            deviceId: proposal.deviceId,
            text: String(proposal.text || "").slice(0, 500),
          },
        });
      },
      onStatus: (message) => broadcast({ type: "log", message }),
    })
  : null;

process.on("message", (message) => {
  if (message?.type === "approve-device" && relay) {
    const result = relay.approve(message.request);
    if (result.ok) {
      devices.set(message.request.deviceId, { revoked: false });
      store.saveDevice({ id: message.request.deviceId, name: message.request.name, publicKey: message.request.publicKey });
    }
    broadcast({ type: "pair-result", result, deviceId: message.request.deviceId });
  }
  if (message?.type === "revoke-device") {
    devices.set(message.deviceId, { revoked: true });
    store.revokeDevice(message.deviceId);
  }
});

createBot();

function shutdown() {
  clearTimeout(reconnectTimer);
  bot?.quit?.();
  relay?.stop?.();
  store.close();
  server.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
