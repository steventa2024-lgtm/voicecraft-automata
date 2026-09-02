import { createFileRoute } from "@tanstack/react-router";
import { errorResponse } from "@/lib/server/auth.server";
import { clearKeygenSessionCookie, requireSameOrigin } from "@/lib/server/keygen-auth.server";

export const Route = createFileRoute("/api/key-generator/logout")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      requireSameOrigin(request);
      return Response.json(
        { ok: true },
        { headers: { "set-cookie": clearKeygenSessionCookie(request), "cache-control": "no-store" } },
      );
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
