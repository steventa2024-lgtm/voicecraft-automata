# VoiceCraft Mobile (Expo / iOS + Android)

First-phase native companion for console players. Lives alongside the existing website and desktop app in the same repository; neither is replaced.

## Currently implemented
- Expo/React Native starter, dark ZeroPulse styling and mobile navigation.
- Email/password sign-in and session persistence against the existing Supabase project, once public configuration is supplied.
- Console onboarding for PS5 and Xbox.
- Explicit pairing requests through a future authenticated cloud API.
- Typed build-preview requests and explicit confirmation requests through that API.
- Push-to-talk recording via expo-audio and transcription upload contract.
- Honest offline/unconfigured states. No demo commands are sent to an insecure short-code relay.

## Not implemented yet
The backend services below do **not** exist in the current repository. A cloud Minecraft host, server-managed pairing, build jobs, live progress, preview rendering, and real end-to-end PS5/Xbox operation must be developed and tested separately. The app does not claim console connectivity until the server responds.

### Cloud API contract (all endpoints HTTPS and JWT-authenticated)
- POST /api/mobile/pairing/claim {code,platform} -> {worldId,worldName,platform}. **Server** must validate ownership, expiry, identity and one-time claim.
- POST /api/mobile/builds/preview {worldId,instruction} -> {previewId,summary,estimatedBlocks,requiresConfirmation:true}. Must not mutate world.
- POST /api/mobile/builds/confirm {previewId} -> {jobId,status}. Server must re-check authorization, validate exact plan and entitlement, enforce idempotency, and securely dispatch.
- POST /api/mobile/transcribe multipart(audio) -> {text}. Server must validate user, format, size, duration, and cost limits. Audio is not implicitly a command.

Never call the existing public Supabase broadcast relay for mobile operations. Do not send the existing runner token to the phone.

## Local setup
1. Install Node.js 22.13+.
2. From repository root: cd mobile
3. Run: npm install
4. Copy .env.example to .env and fill in the SAME existing Supabase project URL and PUBLISHABLE key as the website. Set cloud API URL only once that authenticated backend has been deployed.
5. Run: npx expo install --check
6. Run: npx expo start
7. Scan QR with Expo Go on an iPhone or Android phone on the same network. If the network blocks LAN access, try npx expo start --tunnel.
8. Run: npm run typecheck

For EAS device builds: npm install -g eas-cli ; eas login ; eas init ; eas build --platform ios --profile preview (or android). iOS device distribution may require an Apple developer account.

Environment values beginning EXPO_PUBLIC_ are embedded in the app bundle. **Never place secret server credentials in them.**

The production Supabase auth flow, API endpoints, secure console identity pairing and app-store workflows require additional implementation and actual-device validation.

## Security requirements before enabling live builds
- Validate Supabase Bearer JWT on server, never trust client-submitted identity.
- User's account must be entitled to use the requested world.
- Pairing must be server-side, time-limited, one-time and account/player verified.
- No destructive command without server-generated preview and separate confirmation.
- Check world permissions and usage quotas again on confirmation.
- Log exact job and allow stop/undo only for authorized user.
- Store sensitive data only in approved secure storage; avoid credentials in logs.
