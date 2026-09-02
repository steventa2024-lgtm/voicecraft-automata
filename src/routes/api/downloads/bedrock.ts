import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, requireApiUser } from "@/lib/server/auth.server";
import { createProtectedDownloadUrl } from "@/lib/server/downloads.server";

export const Route = createFileRoute("/api/downloads/bedrock")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      const user = await requireApiUser(request);
      return Response.json({ url: await createProtectedDownloadUrl("bedrock", user.id, request), expiresIn: 120 });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
