/**
 * Watches the hosted Java server for "vc pair" and asks the cloud API for a
 * one-time code. The code is printed in chat. It is not authorization by itself.
 * The player UUID comes from the server's player list. Offline-mode names without
 * a UUID are ignored. Set CLOUD_REQUIRE_FLOODGATE=1 to accept only Floodgate UUIDs.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "bridge/package.json"));
const mineflayer = require("mineflayer");

const api = process.env.VOICECRAFT_API_URL || "http://127.0.0.1:8787";
const token = process.env.CLOUD_SERVER_TOKEN || "";
if (token.length < 24) {
  console.error("[chat-bridge] CLOUD_SERVER_TOKEN must be at least 24 characters.");
  process.exit(1);
}

function floodgateUuid(uuid) {
  return String(uuid || "").toLowerCase().startsWith("00000000-0000-0000");
}

const bot = mineflayer.createBot({
  host: process.env.MC_HOST || "127.0.0.1",
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.MC_USERNAME || "VoiceCraft",
  auth: "offline",
  version: process.env.MC_VERSION || false,
});

bot.on("spawn", () => console.log("[chat-bridge] connected"));
bot.on("error", (error) => console.error("[chat-bridge]", error.message));
bot.on("chat", async (username, message) => {
  if (message.trim().toLowerCase() !== "vc pair") return;
  const player = bot.players?.[username];
  const uuid = player?.uuid;
  if (!uuid) {
    bot.chat("VoiceCraft could not verify that player. No pairing code was issued.");
    return;
  }
  if (process.env.CLOUD_REQUIRE_FLOODGATE === "1" && !floodgateUuid(uuid)) {
    bot.chat("This server only pairs Floodgate console players.");
    return;
  }
  const platform = floodgateUuid(uuid) ? "bedrock" : "ps5";
  const response = await fetch(new URL("/api/mobile/pairing/issue", api), {
    method: "POST",
    headers: { "content-type": "application/json", "x-server-token": token },
    body: JSON.stringify({
      playerUuid: uuid,
      playerName: username,
      platform: process.env.PAIR_PLATFORM || platform,
      worldId: process.env.WORLD_ID || "public-build",
      worldName: process.env.WORLD_NAME || "VoiceCraft Cloud",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    bot.chat("Pairing is unavailable right now.");
    return;
  }
  bot.chat(`VoiceCraft code ${body.code}. Enter it in the mobile app. It expires quickly.`);
});
