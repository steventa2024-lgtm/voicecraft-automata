/**
 * Optional Supabase Realtime transport.
 * A pairing code only opens a short-lived handshake. It never authorizes a build.
 * Paired devices sign proposals with an Ed25519 key. The desktop user still approves execution.
 */
import { createHash, createPublicKey, diffieHellman, generateKeyPairSync, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fingerprintPublicKey } from "../packages/protocol/src/envelope.js";
import { createRateLimiter } from "../packages/protocol/src/security.js";

export function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function deriveSessionId(privateKey, remotePublicPem) {
  const secret = diffieHellman({ privateKey, publicKey: createPublicKey(remotePublicPem) });
  return createHash("sha256").update(secret).digest("hex").slice(0, 32);
}

export function startRelay({ code, onProposal, onPairRequest, onStatus = () => {}, isDeviceApproved }) {
  const url = process.env.ZP_RELAY_URL;
  const key = process.env.ZP_RELAY_KEY;
  const pair = normalizeCode(code);
  if (!url || !key) {
    onStatus("Remote relay is off. Set ZP_RELAY_URL and ZP_RELAY_KEY to enable pairing.");
    return null;
  }
  if (!pair) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 8 } },
  });
  const allow = createRateLimiter({ limit: 8, windowMs: 60_000 });
  const issuedAt = Date.now();
  let consumed = false;
  const handshake = client.channel(`zp-pair-${pair}`, { config: { broadcast: { self: false } } });

  handshake.on("broadcast", { event: "pair" }, ({ payload }) => {
    if (consumed || Date.now() - issuedAt > 5 * 60_000) {
      onStatus("Ignored an expired pairing attempt.");
      return;
    }
    if (!allow(payload?.deviceId || "unknown")) {
      onStatus("Pairing rate limit reached.");
      return;
    }
    if (!payload?.publicKey || !payload?.deviceId || !payload?.exchangeKey) {
      onStatus("Rejected a malformed pairing request.");
      return;
    }
    onPairRequest?.({
      deviceId: String(payload.deviceId).slice(0, 120),
      name: String(payload.name || "Companion").slice(0, 80),
      publicKey: String(payload.publicKey),
      exchangeKey: String(payload.exchangeKey),
      fingerprint: fingerprintPublicKey(payload.publicKey),
    });
  });

  handshake.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus(`Pairing window open for code ${pair}. It expires in 5 minutes.`);
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus("Relay connection problem.");
  });

  return {
    code: pair,
    approve(request) {
      if (consumed) return { ok: false, message: "Pairing code was already used." };
      consumed = true;
      const mine = generateKeyPairSync("x25519");
      let sessionId;
      try {
        sessionId = deriveSessionId(mine.privateKey, request.exchangeKey);
      } catch {
        return { ok: false, message: "Could not establish a device session key." };
      }
      const channel = client.channel(`zp-session-${sessionId}`, { config: { broadcast: { self: false } } });
      const seen = new Set();
      channel.on("broadcast", { event: "cmd" }, ({ payload }) => {
        if (!isDeviceApproved?.(request.deviceId)) {
          onStatus("Rejected a command from an unpaired device.");
          return;
        }
        if (!payload?.nonce || seen.has(payload.nonce)) {
          onStatus("Rejected a replayed remote command.");
          return;
        }
        if (!payload.exp || payload.exp < Date.now()) {
          onStatus("Rejected an expired remote command.");
          return;
        }
        seen.add(payload.nonce);
        onProposal?.({ ...payload, deviceId: request.deviceId });
      });
      channel.subscribe();
      handshake.send({
        type: "broadcast",
        event: "approved",
        payload: {
          deviceId: request.deviceId,
          publicKey: mine.publicKey.export({ type: "spki", format: "pem" }),
        },
      });
      return { ok: true, sessionId };
    },
    publish(payload) {
      handshake.send({ type: "broadcast", event: "evt", payload }).catch(() => {});
    },
    stop() {
      client.removeChannel(handshake);
    },
  };
}

export function createPairCode() {
  return randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}
