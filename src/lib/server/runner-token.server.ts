import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./auth.server";

interface RunnerTokenPayload {
  sub: string;
  scope: "builder:verify";
  exp: number;
}

function secret() {
  const value = process.env["RUNNER_TOKEN_SECRET"];
  if (!value || value.length < 32) {
    throw new Error("RUNNER_TOKEN_SECRET must contain at least 32 characters");
  }
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function issueRunnerToken(userId: string, lifetimeSeconds = 300) {
  const payload: RunnerTokenPayload = {
    sub: userId,
    scope: "builder:verify",
    exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${encoded}.${sign(encoded)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyRunnerToken(token: string) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) {
    throw new ApiError(401, "invalid_runner_token", "Runner authorization is invalid.");
  }
  const expected = sign(encoded);
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "invalid_runner_token", "Runner authorization is invalid.");
  }
  let payload: RunnerTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, "invalid_runner_token", "Runner authorization is invalid.");
  }
  if (
    !payload.sub ||
    payload.scope !== "builder:verify" ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new ApiError(401, "expired_runner_token", "Runner authorization has expired.");
  }
  return payload;
}
