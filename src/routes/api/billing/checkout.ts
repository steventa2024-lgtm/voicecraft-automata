import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse, readJson, requireApiUser } from "@/lib/server/auth.server";
import { getStripe, isPlanTier, priceForTier, publicOrigin } from "@/lib/server/stripe.server";

export const Route = createFileRoute("/api/billing/checkout")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const user = await requireApiUser(request);
      const { tier } = await readJson<{ tier?: unknown }>(request);
      if (!isPlanTier(tier)) throw new ApiError(400, "invalid_plan", "Choose a valid subscription plan.");
      const db = supabaseAdmin as any;
      const { data: profile, error } = await db
        .from("voicecraft_profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();
      if (error) throw error;

      const stripe = getStripe();
      let customerId = profile?.stripe_customer_id as string | undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          ...(user.email ? { email: user.email } : {}),
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        const { error: updateError } = await db
          .from("voicecraft_profiles")
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (updateError) throw updateError;
      }

      const origin = publicOrigin(request);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        integration_identifier:
          process.env["STRIPE_INTEGRATION_IDENTIFIER"] || "zeropulse_vqkmtzra",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: priceForTier(tier), quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${origin}/download?checkout=success`,
        cancel_url: `${origin}/download?checkout=cancelled`,
        metadata: { userId: user.id, planTier: tier },
        subscription_data: { metadata: { userId: user.id, planTier: tier } },
      });
      return Response.json({ url: session.url });
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
