import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError } from "./auth.server";
import {
  issueRunnerToken as issueToken,
  verifyRunnerToken as verifyToken,
} from "../../../packages/protocol/src/tokens.js";

function secret() {
  const value = process.env["RUNNER_TOKEN_SECRET"];
  if (!value || value.length < 32) {
    throw new Error("RUNNER_TOKEN_SECRET must contain at least 32 characters");
  }
  return value;
}

export async function issueRunnerToken(userId: string, deviceId?: string) {
  const issued = issueToken(userId, secret(), { deviceId });
  const db = supabaseAdmin as unknown as {
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await db.from("voicecraft_runner_token_uses").insert({
    jti: issued.payload.jti,
    user_id: userId,
    expires_at: issued.expiresAt,
  });
  if (error) {
    throw new ApiError(
      503,
      "runner_token_store_unavailable",
      "Build authorization could not be recorded. Apply the latest database migration.",
    );
  }
  return { token: issued.token, expiresAt: issued.expiresAt };
}

export function verifyRunnerToken(token: string) {
  const result = verifyToken(token, secret());
  if (!result.ok || !result.payload) {
    const code = result.ok ? "invalid_runner_token" : result.code;
    throw new ApiError(401, code, result.ok ? "Runner authorization is invalid." : result.message);
  }
  return result.payload;
}
