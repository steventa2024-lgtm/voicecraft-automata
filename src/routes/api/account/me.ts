import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, requireApiUserClient } from "@/lib/server/auth.server";

export const Route = createFileRoute("/api/account/me")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      const { user, client: db } = await requireApiUserClient(request);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: profile, error: profileError }, { data: usage, error: usageError }] =
        await Promise.all([
          db.from("voicecraft_profiles").select("email,is_admin,plan_tier,subscription_status,unlimited_tester,daily_usage_counter").eq("id", user.id).single(),
          db.from("voicecraft_daily_usage").select("task_count,block_count").eq("user_id", user.id).eq("usage_date", today).maybeSingle(),
        ]);
      if (profileError) throw profileError;
      if (usageError) throw usageError;
      const adminEmails = (process.env["ADMIN_EMAILS"] || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      const isAdmin = Boolean(
        profile?.is_admin || (user.email && adminEmails.includes(user.email.toLowerCase())),
      );
      return Response.json({
        user: { id: user.id, email: user.email },
        profile,
        usage: usage || { task_count: 0, block_count: 0 },
        isAdmin,
      });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
