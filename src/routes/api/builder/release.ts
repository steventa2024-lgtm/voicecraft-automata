import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse, readJson } from "@/lib/server/auth.server";
import { verifyRunnerToken } from "@/lib/server/runner-token.server";

export const Route = createFileRoute("/api/builder/release")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const runnerToken = request.headers.get("x-zeropulse-runner-token");
          if (!runnerToken) {
            throw new ApiError(401, "invalid_runner_token", "Runner authorization is required.");
          }
          const payload = verifyRunnerToken(runnerToken);
          const body = await readJson<{ requestedBlocks?: unknown; placed?: unknown }>(request);
          const requestedBlocks = Number(body.requestedBlocks);
          const placed = Number(body.placed);
          if (!Number.isInteger(requestedBlocks) || requestedBlocks < 1 || requestedBlocks > 1_000_000) {
            throw new ApiError(400, "invalid_block_count", "requestedBlocks must be an integer from 1 to 1,000,000.");
          }
          if (!Number.isInteger(placed) || placed < 0) {
            throw new ApiError(400, "invalid_placed_count", "placed must be a non-negative integer.");
          }
          const db = supabaseAdmin as any;
          const { data, error } = await db.rpc("release_builder_reservation", {
            p_user_id: payload.sub,
            p_requested_blocks: requestedBlocks,
            p_placed: placed,
          });
          if (error) throw error;
          return Response.json(data);
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
