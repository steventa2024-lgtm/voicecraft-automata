import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse, requireApiUser } from "@/lib/server/auth.server";
import { getStripe, publicOrigin } from "@/lib/server/stripe.server";

export const Route = createFileRoute("/api/billing/portal")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const user = await requireApiUser(request);
      const db = supabaseAdmin as any;
      const { data, error } = await db
        .from("voicecraft_profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      if (!data?.stripe_customer_id) {
        throw new ApiError(409, "no_billing_account", "Choose a plan before opening billing settings.");
      }
      const session = await getStripe().billingPortal.sessions.create({
        customer: data.stripe_customer_id,
        return_url: `${publicOrigin(request)}/download`,
      });
      return Response.json({ url: session.url });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
