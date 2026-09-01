/**
 * Cloud relay client for the bridge.
 *
 * Joins the same Realtime broadcast channel the dashboard uses so a phone on
 * mobile data can drive the bot running on this PC. No inbound ports, no
 * router config — the bridge dials out.
 */
import { createClient } from "@supabase/supabase-js";

const DEFAULT_RELAY_URL = process.env.ZP_RELAY_URL || "https://gckxbefamkkgzrjrgcsh.supabase.co";
const DEFAULT_RELAY_KEY =
  process.env.ZP_RELAY_KEY || "sb_publishable_TUWPrsZVkN7E3fKkThInXQ_iqjN-8bN";

export function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

/**
 * @param {{ code: string, onCommand: (payload: any) => void, onStatus?: (msg: string) => void }} opts
 */
export function startRelay({ code, onCommand, onStatus = () => {} }) {
  const pair = normalizeCode(code);
  if (!pair) return null;

  const client = createClient(DEFAULT_RELAY_URL, DEFAULT_RELAY_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  const channel = client.channel(`zp-relay-${pair}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "cmd" }, ({ payload }) => onCommand(payload || {}));

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus(`Relay online — pairing code ${pair}`);
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
      onStatus("Relay connection problem — retrying");
  });

  return {
    code: pair,
    publish(payload) {
      channel.send({ type: "broadcast", event: "evt", payload }).catch(() => {});
    },
    stop() {
      client.removeChannel(channel);
    },
  };
}
