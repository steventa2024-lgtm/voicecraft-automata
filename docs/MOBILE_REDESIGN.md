# VoiceCraft mobile redesign and verification

Implemented on the existing `cursor/voicecraft-mobile-cloud-0daa` branch for draft PR #3. The audit started at `cffe14e`. No Minecraft world was changed, no new project was created, and no paid service was added.

## Actual screen comparisons

Open [the comparison gallery](visual-verification/index.html) locally. It places the five user-approved references next to screenshots of the running Expo app. Individual captures:

- [Home](visual-verification/home-web-393.png)
- [Catalog](visual-verification/catalog-web-393.png)
- [Blueprint Studio](visual-verification/blueprint-web-393.png) and [its lower controls](visual-verification/blueprint-controls-web-393.png)
- [Console](visual-verification/console-web-393.png) and [pairing](visual-verification/console-pairing-web-393.png)
- [My PC](visual-verification/my-pc-web-393.png) and [build actions](visual-verification/my-pc-actions-web-393.png)
- [Local Library](visual-verification/library-web-393.png)

Captured with Chrome on Windows at 393 × 852 CSS pixels, device scale 2. The app uses an isolated test sign-in and all external requests are blocked by the capture script. These are actual rendered components with unavailable connection states, not screenshot overlays, physical iPhone captures, or evidence of a live build. The Library item was saved through the editor.

The navy palette, landscape hero, six-tab navigation, status cards, structure grid, editor sections, console pairing and PC action hierarchy follow the references. The following differences remain visible:

- The 50 original template generators are preserved. Several create flat-roofed boxes or very simple towers. Their actual geometry cannot reproduce the elaborate cottages, castles and trees in the supplied illustrations. The new previews show that geometry honestly; exact visual parity is **not** claimed.
- Blueprint, Console and an unpaired My PC screen scroll to keep controls operable at narrow phone widths. The reference compresses more information into one screen.
- Unavailable connections have no sample green online indicators, published server address, player name or invented job progress. No live world-view action is offered.
- No physical iPhone, Android, PS5, Xbox or connected Minecraft world was available for end-to-end verification. Native bundles compile; native runtime behavior remains a device-validation step.

## Implementation

| Area             | Main files                                                             | Behavior                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared UI        | `mobile/src/chrome.tsx`, `theme.ts`, `ui.tsx`                          | Safe-area-aware branded headers, gradients, icons, reusable panels, six tabs and accessible control states.                                                                   |
| Home and Catalog | `home.tsx`, `catalog.tsx`                                              | Real statuses, working navigation, searchable 50-template grid, categories and persisted favorites.                                                                           |
| Plan rendering   | `preview.tsx`, `lib/voxel-scene.js`, `scripts/generate-thumbnails.mjs` | Deterministic textured faces, occlusion, depth order, material colors, fitted bounds, grid, zoom and four camera angles. All 50 bundled thumbnails come from canonical plans. |
| Blueprint Studio | `blueprint.tsx`, `lib/template-controls.js`, `lib/approval-gate.js`    | Supported dimensions/materials, rotation, mirroring, history, local save, materials and validation. Options ignored by legacy generators are disabled or shown as fixed.      |
| Console          | `console.tsx`                                                          | PS5/Xbox selection, real health, clipboard, eight-character pairing, prerequisite checks and real unpair action.                                                              |
| My PC            | `pc.tsx`, `lib/companion.ts`, `lib/status-monitor.js`                  | One-time pairing, status polling, truthful permissions/transport, progress and supported build actions. Prepare/Approve navigate to the editor.                               |
| Library          | `library.tsx`, `lib/local-blueprints.js`                               | Migrates existing local saves and supports open/edit/save, rename, favorite, duplicate and confirmed deletion. Cloud storage remains separate.                                |

The renderer preserves solid cell positions and counts and applies last-write-wins air removal. It uses original procedural colors/textures. Non-cube blocks have simplified shapes; it does not simulate Minecraft block states, lighting, fluid flow or live terrain. No decorative geometry is inserted into a plan preview. The header landscape is decorative artwork, not a template or build result.

## Functional and security corrections

1. Ground/floating placement is part of the canonical plan. A bounded 1–16 block elevation shifts all cells, changes the fingerprint, persists in exported/local blueprints, and participates in bridge world-height checks. Water-surface placement is disabled.
2. Every plan edit invalidates the preparation ticket. Late responses, mismatched fingerprints/counts/hosts, navigation away and app backgrounding cannot retain authorization. The companion consumes its preview before awaiting build execution, preventing duplicate in-flight approvals.
3. PC and cloud refresh failures clear prior online data. Request generations reject late responses, backgrounding clears stale statuses, and job polling does not leave old progress after failure. Companion tokens are bound to the saved host and are not sent to an edited, unpaired address.
4. Local saves are managed in Library rather than hidden in storage. Reopening restores the same options; saving updates that record instead of creating another copy.
5. The bridge previously rejected template instructions at its strict command schema. The new template branch validates known template IDs/options, reconstructs canonical instructions and continues to force explicit approval and the protected-block policy. Caller-supplied approval or coordinates do not grant authority.
6. Desktop job progress now preserves counts across progress-only events, calculates percentages from confirmed placements and resets for a new plan.

Supabase authentication, entitlements, protected-container checks, one-time private-network pairing, default-disabled remote builds, the Minecraft bridge and desktop build flow remain in place. LAN HTTP is explicitly described as unencrypted. No shell, screen-sharing or general desktop-control capability was added.

## Validation

| Check                             | Result                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root Node tests                   | 70 passing, including all prior protocol/security/cloud tests and the new placement, approval, renderer, status, Library and companion replay cases.                                           |
| Mobile TypeScript                 | Passing. Includes browser test sources.                                                                                                                                                        |
| Desktop TypeScript and Vite build | Passing.                                                                                                                                                                                       |
| Website production build          | Passing. Existing chunk-size/dynamic-import advisories remain.                                                                                                                                 |
| Expo Doctor                       | 21/21 checks passing after aligning Expo and React Native Web patch versions.                                                                                                                  |
| Expo export                       | iOS, Android and web bundles generated successfully.                                                                                                                                           |
| Browser interaction tests         | Nine cases cover the four requested fixes, transformations/history/camera, catalog/favorites, stale previews, supported PC requests, cloud failures and all six screens at 320/393/430 widths. |
| Visual inspection                 | Five primary screenshots plus four lower-screen/Library captures inspected; no page errors reported.                                                                                           |

The browser tests replace network responses with explicit fixtures and never contact a real PC, Supabase account or Minecraft server. Connected-state test fixtures are not used as purported live-build screenshots. A new `mobile-ui` CI job runs typechecking, all-platform export and browser tests alongside the existing root and desktop jobs.

## Reproduce

```sh
npm test
cd mobile
npm ci
npm run typecheck
npx expo-doctor
npx expo export --platform all --output-dir dist-validation
npx playwright install chromium
npm run test:ui
```

On Windows the browser tests use installed Chrome; other platforms use Playwright Chromium. The test runner starts an isolated Expo server on port 8092 with dummy public configuration when no development server is already running. External requests are blocked. `npm run thumbnails` deterministically regenerates the 50 bundled plan images. To refresh captures, start Expo on port 8092 and run `npm run screenshots` in `mobile`.

## Asset provenance

`mobile/assets/night-landscape.png` was generated with the built-in image generation tool for this redesign. Design brief: a cinematic Minecraft-inspired midnight navy forest, mountains and lake, a warmly lit cottage on the right, dark negative space on the left, no UI, text or logos. It is used only as decorative header/banner art. Catalog images are generated locally from executable plans, not AI-generated structure concepts. `docs/visual-verification/approved-*.jpg` are the user's supplied approved references.
