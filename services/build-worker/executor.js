import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { placeBlocks } from "../../bridge/placer.js";
import { playerFromBot, worldBlocksFromPlan } from "./plan-world.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "bridge/package.json"));
const mineflayer = require("mineflayer");

export function createMinecraftExecutor({ host, port, username, version, worldId, store }) {
  let bot = null;
  let connecting = null;

  function connect() {
    if (bot) return Promise.resolve(bot);
    if (connecting) return connecting;
    connecting = new Promise((resolve, reject) => {
      const next = mineflayer.createBot({
        host,
        port: Number(port),
        username: username || "VoiceCraft",
        auth: "offline",
        version: version || false,
      });
      const fail = (error) => {
        connecting = null;
        bot = null;
        reject(error);
      };
      next.once("error", fail);
      next.once("end", () => {
        bot = null;
      });
      next.once("spawn", () => {
        bot = next;
        connecting = null;
        resolve(next);
      });
    });
    return connecting;
  }

  return {
    async execute({ job, plan, preview }) {
      if (worldId && preview.world_id !== worldId) {
        throw new Error("The approved preview belongs to a different world.");
      }
      const link = store.linkById(preview.link_id);
      if (!link || link.revoked_at || link.user_id !== job.user_id || link.world_id !== job.world_id) {
        throw new Error("The pairing for this job is no longer valid.");
      }
      const connected = await connect();
      const actor = playerFromBot(connected, link.player_name);
      if (!actor) throw new Error("The linked player is not visible in the hosted world.");
      if (link.player_uuid && actor.uuid && actor.uuid.toLowerCase() !== link.player_uuid.toLowerCase()) {
        throw new Error("The visible player UUID does not match the paired identity.");
      }
      const instruction = JSON.parse(preview.instruction_json);
      const blocks = worldBlocksFromPlan(plan, instruction, actor, actor.yaw);
      const control = { cancelled: false, paused: false };
      const poll = setInterval(() => {
        const latest = store.jobById(job.id);
        if (latest?.status === "cancelling") control.cancelled = true;
      }, 250);
      try {
        const result = await placeBlocks(connected, blocks, null, control, (progress) => {
          store.updateJobProgress(job.id, progress.placed || 0, progress.failed || 0);
        });
        return {
          confirmed: result.placed || 0,
          failed: result.failed || 0,
          error: result.status === "completed" ? null : result.status,
        };
      } finally {
        clearInterval(poll);
      }
    },
  };
}
