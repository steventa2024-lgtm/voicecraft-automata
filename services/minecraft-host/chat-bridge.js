/**
 * Watches the hosted Java server for "vc pair" and asks the cloud API for a
 * one-time code. The code is printed in chat. It is not authorization by itself.
 *
 * The host sends only a server-verified player UUID and whether the player
 * arrived through Bedrock/Floodgate. It never labels the player as PS5 or Xbox.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function isFloodgateUuid(uuid) {
  return String(uuid || "").toLowerCase().startsWith("00000000-0000-0000");
}

export function pairingIssueBody({ uuid, username, worldId, worldName }) {
  return {
    playerUuid: uuid,
    playerName: username,
    bedrock: isFloodgateUuid(uuid),
    worldId: worldId || "public-build",
    worldName: worldName || "VoiceCraft Cloud",
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const token = process.env.CLOUD_SERVER_TOKEN || "";
  if (token.length < 24) {
    console.error("[chat-bridge] CLOUD_SERVER_TOKEN must be at least 24 characters.");
    process.exit(1);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const require = createRequire(path.join(root, "bridge/package.json"));
  const mineflayer = require("mineflayer");
  const api = process.env.VOICECRAFT_API_URL || "http://127.0.0.1:8787";
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
    if (process.env.CLOUD_REQUIRE_FLOODGATE === "1" && !isFloodgateUuid(uuid)) {
      bot.chat("This server only pairs Floodgate console players.");
      return;
    }
    const response = await fetch(new URL("/api/mobile/pairing/issue", api), {
      method: "POST",
      headers: { "content-type": "application/json", "x-server-token": token },
      body: JSON.stringify(pairingIssueBody({
        uuid,
        username,
        worldId: process.env.WORLD_ID,
        worldName: process.env.WORLD_NAME,
      })),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      bot.chat("Pairing is unavailable right now.");
      return;
    }
    bot.chat(`VoiceCraft code ${body.code}. Enter it in the mobile app. It expires quickly.`);
  });
}
