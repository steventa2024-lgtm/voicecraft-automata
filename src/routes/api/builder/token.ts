import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, requireApiUser } from "@/lib/server/auth.server";
import { issueRunnerToken } from "@/lib/server/runner-token.server";

export const Route = createFileRoute("/api/builder/token")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const user = await requireApiUser(request);
      return Response.json(await issueRunnerToken(user.id));
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
