# Zero-cost mobile development and hosting policy

**Status:** product requirement for VoiceCraft Mobile and the console companion work in PR #3.  
**Budget:** $0 new spending for development, testing, paid APIs, SaaS upgrades, or hosting. The project owner may separately choose to pay for the **Apple Developer Program** when distributing iOS builds. Nothing in the code or deployment scripts may purchase or subscribe to services automatically.

## What "free" means

Open-source source code, mobile development tools and local testing can be free, **but computational resources are not free to operate**. This project must not misrepresent an always-on hosted Minecraft world as guaranteed free.

- **Mobile app:** Expo / React Native; keep iOS and Android source available and avoid paid SDK dependencies. Prefer Expo Go for initial iPhone testing. Use free EAS quotas if they are available; wait or build locally when quotas run out instead of upgrading.
- **Authentication:** reuse the existing Supabase project on its available free plan and monitor quota limits. Do not require Supabase Pro, paid edge services, SMS, or external billing add-ons for baseline development.
- **AI:** normal building commands work without AI. Optional Ollama and Whisper inference must use user-controlled or community-supplied hardware, without paid APIs.
- **Minecraft server:** local development can use an existing Windows, macOS or Linux computer with Docker and an accepted Minecraft EULA. The project must not automatically lease a VPS, use a credit card, or demand a paid host for testing.
- **No-PC console players:** an *already-running* authorized Minecraft server is still required. It may be community-operated, donated, run on hardware another person owns, or supplied by the user. A free tier may be explored **only when its actual quotas and suitability are verified**. No free uptime, capacity or console connection is promised.
- **Console restrictions:** PS5/Xbox players can join compatible Bedrock multiplayer servers using documented, platform-permitted setup methods; this does not control an existing console single-player world. Platform multiplayer subscriptions may be required independently of VoiceCraft.

## Three connection modes (one app)

These are deployment choices inside the same mobile app. They are not three products, and none of them lets the phone send Minecraft console commands.

### A. Local developer mode — $0 new purchase

A developer uses their existing computer to run the cloud API, optional Minecraft server and build worker, and runs the mobile client through Expo Go.

This is intended for development. It is not a 24/7 service for players who do not own computers.

1. Use current mobile branch and the same existing Supabase project's **publishable** URL/key (no service-role keys in `EXPO_PUBLIC_*`).
2. Start the API on a trusted development network with an explicit token and pepper.
3. Configure the phone's API URL with the computer's reachable LAN IP, never the phone's localhost. Use HTTPS for publicly reachable deployments.
4. Launch Metro; scan the Expo QR code on the iPhone.
5. Verify sign-in and API health before starting Minecraft.
6. Start a test Minecraft server only after accepting its EULA and checking version compatibility.

### B. Community server mode — operator-owned hardware

An authorized community server operator hosts a compatible Minecraft world and installs the VoiceCraft adapter. Console players join that world. The phone connects only to the operator's VoiceCraft API over HTTPS.

The operator must explicitly install and configure the integration. Players can pair, and they can revoke their own device. They cannot install integrations or run privileged actions on a server they do not control.

### C. User-supplied server mode — hardware the owner already controls

An authorized server owner runs the same API, worker, and Minecraft adapter on a Linux, Windows, or macOS computer they already have. Setup is in `docs/MOBILE_CLOUD.md`. This milestone does not rent a VPS.

If the person does not control the server, this mode does not apply. They use community mode and need the operator's permission.

No seamless phone-controlled construction can be promised in unrelated servers or single-player worlds. Make every connection status and service limitation explicit in the UI. Open-source software does not make a Minecraft server free to operate: electricity, hardware, and any platform multiplayer subscription remain real costs.

## Expense guardrails

- Do not create paid cloud resources, new organizations on paid plans, credit-card integrations, paid API credentials or auto-renewing services.
- Never enable automatic EAS upgrades, Supabase upgrades, paid transcription or inference providers.
- Never add a mandatory service dependency that is free only during a brief trial.
- The only user-authorized optional spend is Apple Developer Program membership for iOS distribution. Do not enroll or charge on the owner's behalf.
- Preserve existing Stripe/billing code and product decisions; a free/open-source application is not automatically equivalent to free hosted compute. Do not alter pricing or entitlements without approval.
- When free quotas or equipment are insufficient, **report the limitation** rather than silently incur charges.

## Open-source licensing status (owner decision needed)

The repository is publicly visible, but this branch did not contain a root `LICENSE` file at the time of this review. **A public repository is not automatically open-source licensed.**

Before advertising a formal open-source license, audit third-party code/dependencies and request the owner's explicit license choice (for example MIT, Apache-2.0 or GPL-family, depending on the intended copyleft and patent terms). Do not unilaterally select a license or assume existing paid subscriptions control source-code rights.

## Acceptance checks

- [ ] Expo mobile interface and the local API can be developed and tested without subscribing to any paid service.
- [ ] The mobile app behaves honestly when Supabase, a hosted server, AI speech transcription, or Minecraft is offline.
- [ ] Clear docs distinguish local developer mode, community server mode, and user-supplied server mode.
- [ ] Existing computer + local test network is sufficient for initial end-to-end testing, subject to available hardware and account access.
- [ ] Production console operation is described as dependent on a real third-party/community/owner host; no "free forever" server promise.
- [ ] CI/dev scripts do not provision paid resources or print secrets.
- [ ] Apple Developer Program is the only optional developer expense approved by the owner.
- [ ] No formal OSS license is added until the owner approves the actual terms.
