import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

function sign(encoded, secret) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function issueRunnerToken(userId, secret, options = {}) {
  if (!secret || String(secret).length < 32) {
    throw new Error("Runner token secret must contain at least 32 characters.");
  }
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const lifetime = options.lifetimeSeconds ?? 300;
  const payload = {
    sub: userId,
    scope: "builder:verify",
    iat: now,
    exp: now + lifetime,
    jti: options.jti || randomUUID(),
    deviceId: options.deviceId || null,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${encoded}.${sign(encoded, secret)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    payload,
  };
}

export function verifyRunnerToken(token, secret, options = {}) {
  if (!secret || String(secret).length < 32) {
    return { ok: false, code: "invalid_runner_token", message: "Runner authorization is invalid." };
  }
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, code: "invalid_runner_token", message: "Runner authorization is invalid." };
  }
  const [encoded, signature] = parts;
  if (!safeEqual(signature, sign(encoded, secret))) {
    return { ok: false, code: "invalid_runner_token", message: "Runner authorization is invalid." };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "invalid_runner_token", message: "Runner authorization is invalid." };
  }
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!payload.sub || payload.scope !== "builder:verify" || !Number.isFinite(payload.exp) || !payload.jti) {
    return { ok: false, code: "invalid_runner_token", message: "Runner authorization is invalid." };
  }
  if (payload.exp <= now) {
    return { ok: false, code: "expired_runner_token", message: "Runner authorization has expired." };
  }
  if (options.expectedDeviceId && payload.deviceId !== options.expectedDeviceId) {
    return { ok: false, code: "device_mismatch", message: "Runner authorization is for a different device." };
  }
  if (options.isConsumed?.(payload.jti)) {
    return { ok: false, code: "replayed_runner_token", message: "Runner authorization was already used." };
  }
  return { ok: true, payload };
}
