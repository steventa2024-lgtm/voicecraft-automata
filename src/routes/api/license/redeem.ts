import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse, readJson, requireApiUser } from "@/lib/server/auth.server";
import { normalizeLicenseKey, sha256 } from "@/lib/server/crypto.server";

export const Route = createFileRoute("/api/license/redeem")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const user = await requireApiUser(request);
      const { key, hwid } = await readJson<{ key?: unknown; hwid?: unknown }>(request);
      const normalized = normalizeLicenseKey(typeof key === "string" ? key : "");
      if (!normalized) {
        throw new ApiError(400, "invalid_key_format", "Use the format Zero-xxxxx-xxxxx-xxxxx.");
      }
      if (typeof hwid !== "string" || hwid.trim().length < 8 || hwid.length > 512) {
        throw new ApiError(400, "hwid_required", "Connect the desktop companion before redeeming a key.");
      }
      const db = supabaseAdmin as any;
      const { data, error } = await db.rpc("voicecraft_redeem_license_key", {
        p_user_id: user.id,
        p_key_hash: await sha256(normalized),
        p_hwid_hash: await sha256(hwid.trim()),
      });
      if (error) throw error;
      return Response.json(data, { status: data?.ok ? 200 : 409 });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
