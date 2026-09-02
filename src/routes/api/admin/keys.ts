import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse, readJson, requireAdmin } from "@/lib/server/auth.server";
import { generateLicenseKey, keyHint, sha256 } from "@/lib/server/crypto.server";

export const Route = createFileRoute("/api/admin/keys")({
  server: { handlers: {
  GET: async ({ request }) => {
    try {
      await requireAdmin(request);
      const db = supabaseAdmin as any;
      const { data, error } = await db
        .from("license_keys")
        .select("id,key_hint,status,claimed_by_user_id,created_at,activated_at,revoked_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return Response.json({ keys: data || [] });
    } catch (error) {
      return errorResponse(error);
    }
  },
  POST: async ({ request }) => {
    try {
      const admin = await requireAdmin(request);
      const body = await readJson<{ count?: unknown }>(request);
      const count = Math.min(25, Math.max(1, Math.floor(Number(body.count) || 1)));
      const db = supabaseAdmin as any;
      const plaintextKeys: string[] = [];

      for (let index = 0; index < count; index += 1) {
        let created = false;
        for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
          const key = generateLicenseKey();
          const { error } = await db.from("license_keys").insert({
            key_hash: await sha256(key.toUpperCase()),
            key_hint: keyHint(key),
            created_by_user_id: admin.id,
          });
          if (!error) {
            plaintextKeys.push(key);
            created = true;
          } else if (error.code !== "23505") {
            throw error;
          }
        }
        if (!created) throw new Error("Could not allocate a unique license key");
      }

      return Response.json({
        keys: plaintextKeys,
        warning: "These plaintext keys are shown once. Store them securely.",
      });
    } catch (error) {
      return errorResponse(error);
    }
  },
  PATCH: async ({ request }) => {
    try {
      await requireAdmin(request);
      const { id, status } = await readJson<{ id?: unknown; status?: unknown }>(request);
      if (typeof id !== "string" || status !== "revoked") {
        throw new ApiError(400, "invalid_request", "A key ID and revoked status are required.");
      }
      const db = supabaseAdmin as any;
      const { data, error } = await db.rpc("revoke_license_key", { p_key_id: id });
      if (error) throw error;
      if (!data?.ok) {
        throw new ApiError(404, data?.code || "key_not_found", data?.message || "License key was not found.");
      }
      return Response.json(data);
    } catch (error) {
      return errorResponse(error);
    }
  },
  } },
});
