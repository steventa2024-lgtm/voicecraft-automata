import { createFileRoute } from "@tanstack/react-router";
import { ApiError, errorResponse, readJson } from "@/lib/server/auth.server";
import { generateLicenseKey, keyHint, sha256 } from "@/lib/server/crypto.server";
import { requireKeygenAdmin, requireSameOrigin } from "@/lib/server/keygen-auth.server";

function requireAdminDatabase() {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    throw new ApiError(
      503,
      "admin_database_unconfigured",
      "The private database connection is unavailable on this server. Open the hosted key generator or configure the server-only Supabase secret.",
    );
  }
}

async function database() {
  requireAdminDatabase();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const Route = createFileRoute("/api/key-generator/keys")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await requireKeygenAdmin(request);
        const db = await database();
        const { data, error } = await db
          .from("license_keys")
          .select("id,key_hint,status,claimed_by_user_id,created_at,activated_at,revoked_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return Response.json({ keys: data || [] }, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error);
      }
    },
    POST: async ({ request }) => {
      try {
        requireSameOrigin(request);
        await requireKeygenAdmin(request);
        const { count } = await readJson<{ count?: unknown }>(request);
        const keyCount = Math.min(25, Math.max(1, Math.floor(Number(count) || 1)));
        const db = await database();
        const plaintextKeys: string[] = [];
        for (let index = 0; index < keyCount; index += 1) {
          let created = false;
          for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
            const key = generateLicenseKey();
            const { error } = await db.from("license_keys").insert({
              key_hash: await sha256(key.toUpperCase()),
              key_hint: keyHint(key),
            });
            if (!error) {
              plaintextKeys.push(key);
              created = true;
            } else if (error.code !== "23505") {
              throw error;
            }
          }
          if (!created) throw new ApiError(503, "key_generation_failed", "A unique key could not be allocated.");
        }
        return Response.json({
          keys: plaintextKeys,
          warning: "Copy these keys now. Only their secure hashes are stored.",
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
    PATCH: async ({ request }) => {
      try {
        requireSameOrigin(request);
        await requireKeygenAdmin(request);
        const { id, status } = await readJson<{ id?: unknown; status?: unknown }>(request);
        if (typeof id !== "string" || status !== "revoked") {
          throw new ApiError(400, "invalid_request", "A key ID and revoked status are required.");
        }
        const db = await database();
        const { data, error } = await db.rpc("revoke_license_key", { p_key_id: id });
        if (error) throw error;
        if (!data?.ok) throw new ApiError(404, data?.code || "key_not_found", data?.message || "License key was not found.");
        return Response.json(data);
      } catch (error) {
        return errorResponse(error);
      }
    },
  } },
});
