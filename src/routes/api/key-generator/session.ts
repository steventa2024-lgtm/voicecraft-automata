import { createFileRoute } from "@tanstack/react-router";
import { errorResponse } from "@/lib/server/auth.server";
import { requireKeygenAdmin } from "@/lib/server/keygen-auth.server";

export const Route = createFileRoute("/api/key-generator/session")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      await requireKeygenAdmin(request);
      return Response.json({ authenticated: true }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
