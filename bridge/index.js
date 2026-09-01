/**
 * ZeroPulse Bridge — local companion app.
 *
 *   Dashboard (browser)  ──ws://localhost:8765──▶  this process  ──▶  Mineflayer bot ──▶ Minecraft
 *
 * Run:  npm install && npm start
 */
import "dotenv/config";
import { WebSocketServer } from "ws";
import mineflayer from "mineflayer";
import { parseCommand } from "./parser.js";
import { runBuild, clearArea } from "./builder.js";
import { detectMode } from "./placer.js";
import { startRelay, normalizeCode } from "./relay.js";

const PORT = Number(process.env.BRIDGE_PORT || 8765);
const MC_HOST = process.env.MC_HOST || "localhost";
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_USERNAME = process.env.MC_USERNAME || "ZeroPulse";
const MC_VERSION = process.env.MC_VERSION || undefined;
const PAIR_CODE = normalizeCode(process.env.ZP_PAIR_CODE || "");

let bot = null;
let botReady = false;
let currentJob = null;
let placementMode = null;
let relay = null;
const clients = new Set();

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
  if (relay) relay.publish(payload);
}

function currentState(extra = {}) {
  return {
    type: "status",
    status: botReady ? (currentJob && !currentJob.done ? "building" : "connected") : "idle",
    mode: placementMode || undefined,
    message: botReady ? "Bot online" : "Bridge online — waiting for Minecraft",
    ...extra,
  };
}

function handleRemotePayload(payload) {
  if (!payload) return;
  if (payload.type === "hello") {
    if (relay) relay.publish(currentState());
    return;
  }
  if (payload.type === "command") {
    handleInstruction(payload.instruction ?? parseCommand(payload.text || ""));
  }
}

const log = (message, type = "log") => {
  console.log(`[zeropulse] ${message}`);
  broadcast({ type, message });
};

/* ------------------------------------------------------------------ bot */

function createBot() {
  log(`Connecting Mineflayer bot to ${MC_HOST}:${MC_PORT} as ${MC_USERNAME}`);
  bot = mineflayer.createBot({
    host: MC_HOST,
    port: MC_PORT,
    username: MC_USERNAME,
    version: MC_VERSION,
    auth: process.env.MC_AUTH || "offline",
  });

  bot.once("spawn", async () => {
    botReady = true;
    log("Bot spawned in world — ready for build orders");
    broadcast({ type: "status", status: "connected" });
    try {
      placementMode = await detectMode(bot);
      log(
        placementMode === "command"
          ? "Operator rights detected — using /fill placement (fast)"
          : "No operator rights — using creative hand placement",
      );
      broadcast({ type: "mode", mode: placementMode });
    } catch (err) {
      placementMode = "creative";
      log(`Placement probe failed (${err.message}) — defaulting to hand placement`);
    }
  });

  bot.on("kicked", (reason) => {
    botReady = false;
    broadcast({ type: "error", status: "error", message: `Kicked: ${reason}` });
  });

  bot.on("error", (err) => {
    botReady = false;
    broadcast({ type: "error", status: "error", message: `Bot error: ${err.message}` });
  });

  bot.on("end", () => {
    botReady = false;
    broadcast({ type: "status", status: "idle", message: "Bot disconnected — retrying in 10s" });
    setTimeout(createBot, 10_000);
  });

  // Voice commands can also be typed straight into Minecraft chat.
  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    if (!/^(zp|zeropulse)\b/i.test(message)) return;
    handleInstruction(parseCommand(message.replace(/^(zp|zeropulse)\b/i, "")));
  });
}

/* -------------------------------------------------------------- dispatch */

async function handleInstruction(instruction) {
  if (instruction.action === "stop") {
    if (currentJob) currentJob.cancelled = true;
    broadcast({ type: "status", status: "connected", message: "Build aborted", progress: 0 });
    return;
  }

  if (!botReady) {
    broadcast({ type: "error", status: "error", message: "Bot not in world yet" });
    return;
  }

  if (currentJob && !currentJob.done) {
    broadcast({ type: "log", message: "Busy — abort the current build first" });
    return;
  }

  if (instruction.action === "unknown" || instruction.structure === "unknown") {
    broadcast({
      type: "log",
      message: `Unrecognised order: "${instruction.raw}"`,
    });
    return;
  }

  const job = { cancelled: false, done: false };
  currentJob = job;

  broadcast({
    type: "status",
    status: "building",
    message: `Building ${instruction.size} ${instruction.structure} (${instruction.material})`,
    progress: 0,
  });

  const onProgress = (placed, total) =>
    broadcast({ type: "progress", progress: Math.round((placed / total) * 100) });

  try {
    const result =
      instruction.action === "clear"
        ? await clearArea(bot, instruction, job, onProgress, placementMode)
        : await runBuild(bot, instruction, job, onProgress, placementMode);

    const where = result?.origin
      ? ` at ${result.origin.x}, ${result.origin.y}, ${result.origin.z}`
      : "";
    if (!job.cancelled && result?.origin) {
      bot.chat(
        `ZeroPulse: ${instruction.structure} finished${where} (${result.placed} blocks, ${result.mode} mode)`,
      );
    }
    broadcast({
      type: "status",
      status: "connected",
      message: job.cancelled
        ? "Build cancelled"
        : `${instruction.structure} complete — ${result.placed} blocks${where}`,
      progress: job.cancelled ? 0 : 100,
      result: job.cancelled ? undefined : { ...result, structure: instruction.structure },
    });
  } catch (err) {
    broadcast({ type: "error", status: "error", message: `Build failed: ${err.message}` });
  } finally {
    job.done = true;
  }
}

/* ------------------------------------------------------------ ws server */

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  clients.add(ws);
  log(`Dashboard connected (${clients.size} client${clients.size > 1 ? "s" : ""})`);
  ws.send(
    JSON.stringify({
      type: "status",
      status: botReady ? "connected" : "idle",
      message: botReady ? "Bot online" : "Bridge online — waiting for Minecraft",
    }),
  );

  ws.on("message", (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      return;
    }
    handleRemotePayload(payload);
  });

  ws.on("close", () => clients.delete(ws));
});

console.log(`[zeropulse] bridge listening on ws://localhost:${PORT}`);

if (PAIR_CODE) {
  relay = startRelay({
    code: PAIR_CODE,
    onCommand: handleRemotePayload,
    onStatus: (message) => log(message),
  });
  console.log(`[zeropulse] remote control enabled — pairing code ${PAIR_CODE}`);
} else {
  console.log("[zeropulse] remote control off — set ZP_PAIR_CODE to control from your phone");
}

createBot();
