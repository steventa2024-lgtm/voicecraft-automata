import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError } from "./auth.server";
import { isAllowedLoopbackRedirect, verifyPkce } from "../../../packages/protocol/src/security.js";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function assertDesktopAuthRequest(input: {
  codeChallenge?: unknown;
  state?: unknown;
  redirectUri?: unknown;
}) {
  const codeChallenge = String(input.codeChallenge || "");
  const state = String(input.state || "");
  const redirectUri = String(input.redirectUri || "");
  if (codeChallenge.length < 43 || codeChallenge.length > 128) {
    throw new ApiError(400, "invalid_pkce", "The desktop sign-in challenge is invalid.");
  }
  if (state.length < 16 || state.length > 200) {
    throw new ApiError(400, "invalid_state", "The desktop sign-in state is invalid.");
  }
  if (!isAllowedLoopbackRedirect(redirectUri)) {
    throw new ApiError(400, "invalid_redirect", "Desktop sign-in only returns to a local callback.");
  }
  return { codeChallenge, state, redirectUri };
}

export async function issueDesktopCode(
  userId: string,
  input: { codeChallenge: string; state: string; redirectUri: string },
) {
  const code = randomBytes(32).toString("base64url");
  const db = supabaseAdmin as any;
  const { error } = await db.from("desktop_auth_codes").insert({
    code_hash: sha256(code),
    user_id: userId,
    code_challenge: input.codeChallenge,
    state_hash: sha256(input.state),
    redirect_uri: input.redirectUri,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) {
    throw new ApiError(503, "desktop_auth_unavailable", "Desktop sign-in storage is unavailable. Apply the latest database migration.");
  }
  return { code, expiresIn: 300 };
}

export async function exchangeDesktopCode(input: { code?: unknown; verifier?: unknown; state?: unknown }) {
  const code = String(input.code || "");
  const verifier = String(input.verifier || "");
  const state = String(input.state || "");
  if (!code || !verifier || !state) {
    throw new ApiError(400, "invalid_exchange", "Desktop sign-in exchange is incomplete.");
  }
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("desktop_auth_codes")
    .select("code_hash,user_id,code_challenge,state_hash,expires_at,used_at")
    .eq("code_hash", sha256(code))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.used_at || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new ApiError(401, "expired_desktop_code", "That desktop sign-in code is no longer valid.");
  }
  if (data.state_hash !== sha256(state) || !verifyPkce(verifier, data.code_challenge)) {
    throw new ApiError(401, "invalid_pkce", "Desktop sign-in verification failed.");
  }
  const marked = await db
    .from("desktop_auth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", data.code_hash)
    .is("used_at", null);
  if (marked.error) throw marked.error;

  const admin = supabaseAdmin as any;
  const userResult = await admin.auth.admin.getUserById(data.user_id);
  const email = userResult.data?.user?.email;
  if (!email) throw new ApiError(401, "account_missing", "The account no longer has an email address.");
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    throw new ApiError(503, "session_unavailable", "A desktop session could not be created.");
  }
  const verified = await admin.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (verified.error || !verified.data.session) {
    throw new ApiError(503, "session_unavailable", "A desktop session could not be created.");
  }
  return {
    accessToken: verified.data.session.access_token,
    refreshToken: verified.data.session.refresh_token,
    expiresAt: verified.data.session.expires_at,
    user: { id: data.user_id, email },
  };
}
