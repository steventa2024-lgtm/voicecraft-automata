import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse, readJson, requireApiUser } from "@/lib/server/auth.server";
import { verifyRunnerToken } from "@/lib/server/runner-token.server";

export const Route = createFileRoute("/api/builder/verify-run")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const runnerToken = request.headers.get("x-zeropulse-runner-token");
      const tokenPayload = runnerToken ? verifyRunnerToken(runnerToken) : null;
      const userId = tokenPayload ? tokenPayload.sub : (await requireApiUser(request)).id;
      if (tokenPayload) {
        const db = supabaseAdmin as any;
        const consumed = await db.rpc("voicecraft_consume_runner_token", {
          p_jti: tokenPayload.jti,
          p_user_id: tokenPayload.sub,
        });
        if (consumed.error) throw consumed.error;
        if (!consumed.data?.ok) {
          throw new ApiError(401, consumed.data?.code || "invalid_runner_token", consumed.data?.message || "Runner authorization is invalid.");
        }
      }
      const { requestedBlocks } = await readJson<{ requestedBlocks?: unknown }>(request);
      const count = Number(requestedBlocks);
      if (!Number.isInteger(count) || count < 1 || count > 1_000_000) {
        throw new ApiError(400, "invalid_block_count", "requestedBlocks must be an integer from 1 to 1,000,000.");
      }
      const db = supabaseAdmin as any;
      const { data, error } = await db.rpc("voicecraft_verify_and_consume_builder_run", {
        p_user_id: userId,
        p_requested_blocks: count,
      });
      if (error) throw error;
      return Response.json(data, { status: data?.allowed ? 200 : 402 });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
