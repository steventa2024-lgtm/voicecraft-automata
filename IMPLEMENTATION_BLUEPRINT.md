# ZeroPulse auth, billing, downloads, and licensing blueprint

## Apply before deployment

1. Apply supabase/migrations/202609010001_core_auth_billing_licenses.sql.
2. In Supabase Auth, enable Email/Password, Google, and GitHub. Add the deployed
   site URL and /dashboard callback URL to the redirect allowlist.
3. Create three recurring Stripe prices and set the three STRIPE_PRICE
   environment variables from .env.example.
4. Register POST /api/billing/webhook in Stripe for these events:
   checkout.session.completed, customer.subscription.created,
   customer.subscription.updated, and customer.subscription.deleted.
5. Create a private R2 bucket, upload both ZIPs, and configure the R2 variables.
   R2 object URLs must not be public.
6. Promote an administrator in the Supabase SQL editor:

       update public.profiles
       set is_admin = true
       where email = 'owner@example.com';

The usage model is a UTC calendar-day window keyed by user ID and usage date.
It resets without a cron job because each new UTC date receives a new atomic
counter row.

## Existing files modified

- src/routes/__root.tsx — global auth context and modals.
- src/components/site-header.tsx — account and admin navigation.
- src/components/site-footer.tsx — subtle Add a Key trigger.
- src/routes/download.tsx — protected dual downloads, console docs, and plans.
- src/hooks/use-bridge.ts — installation ID capture and short-lived runner auth.
- bridge/index.js — exact pre-build allowance reservation.
- desktop/main.cjs — persistent privacy-preserving installation ID.
- package.json — Stripe and S3-compatible presigning dependencies.

## New application files

- supabase/migrations/202609010001_core_auth_billing_licenses.sql
- src/components/auth-provider.tsx
- src/components/auth-modal.tsx
- src/components/license-key-modal.tsx
- src/routes/admin/keys.tsx
- src/lib/server/auth.server.ts
- src/lib/server/crypto.server.ts
- src/lib/server/stripe.server.ts
- src/lib/server/downloads.server.ts
- src/lib/server/runner-token.server.ts
- src/routes/api/account/me.ts
- src/routes/api/billing/checkout.ts, portal.ts, and webhook.ts
- src/routes/api/builder/token.ts and verify-run.ts
- src/routes/api/downloads/java.ts and bedrock.ts
- src/routes/api/download-files/java.ts and bedrock.ts
- src/routes/api/admin/keys.ts
- src/routes/api/license/redeem.ts
- bedrock-companion/*

## Security boundaries

- Guests cannot obtain download URLs. Authenticated requests receive URLs that
  expire after two minutes.
- Production downloads use a private R2 bucket. Local development uses HMAC
  signed links to files outside public/.
- Stripe webhooks verify the raw request body and signature before mutation.
- Usage reservation is a row-locked database function, preventing concurrent
  builds from racing past a limit.
- Plaintext license keys are returned once. Only SHA-256 key hashes are stored.
- The companion uses a random persistent installation ID, not MAC address, CPU,
  hostname, or another invasive fingerprint. The server hashes that ID with
  SHA-256 and locks a claimed key to it.
- The relay carries a five-minute token scoped only to builder verification,
  never the user's reusable Supabase session token.
- Admin UI checks are for UX. Every admin API independently enforces database
  RBAC or the configured email allowlist.
