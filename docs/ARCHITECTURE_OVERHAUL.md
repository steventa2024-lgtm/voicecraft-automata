# Architecture generator 2

The seven showcase structures were captured from generator 1 before any generator edits. Their original canonical JSON and previews, enhanced canonical JSON, block statistics, and side-by-side images are in [architecture-verification/index.html](architecture-verification/index.html). Run `node scripts/verify-architecture.mjs` from `mobile` to regenerate the enhanced evidence. Original files are retained unchanged.

## Shared architecture

`packages/protocol/src/architecture.js` supplies framed rooms, foundations, entrances, windows, gables, dormers, hip roofs, decks, staircases, chimneys, interiors, trees, gardens and towers. `showcase.js` composes the seven priority structures; `catalog-architecture.js` supplies the other 43 distinct layouts. Voice/text generators use these same components. No plan uses AI artwork or a screenshot as geometry.

The showcase layouts include an L-shaped dockside cottage, a porch cottage, a log cabin, two rooms around a branching tree, a four-tower keep with a great hall, terraced mountain rooms, and a two-storey glass villa. Other catalog identities include colonnaded temples, curtain-wall fortresses, a dragon silhouette, a floating island, a working crop layout, a static windmill, bridges, warehouses, a sawmill wheel, a railway platform, and tiered sports grounds. Decorative machinery does not claim to move or automate production.

Dimensions are architectural footprint controls; actual bounds also include overhangs, landscaping, docks, foundations and balconies. Default counts are derived from canonical cells, including intentional interior air/removal operations. The existing 120,000-operation cap remains in force. The seven default builds and all 50 defaults fit inside the complete 50,000-cell undo snapshot budget. No arbitrary legacy operation count is preserved.

## Preview, approval and placement

- Java Edition **1.21.1** is the explicit registry target. The bundled property allowlist comes from the installed `minecraft-data` 3.115.0 package. Generated materials and supplied properties are validated against it.
- Blocks carry a separate `states` object. Facing, axis, connection directions, door hinges and stair handedness survive rotations, mirrors and the player's world-coordinate basis. State values are included in plan fingerprints and `/fill` grouping.
- Mobile SVG previews, generated thumbnails, and desktop WebGL consume canonical cells and shared block geometry. Textures are original procedural surfaces, not Mojang resource-pack assets. Desktop adds directional shadows and orbit controls; both editors offer interior inspection. Interior inspection only changes the view, never the approved plan.
- Desktop no longer truncates plans to 15,000 blocks. Terrain surveys include the full transformed bounds, including negative coordinates.
- Explicit preparation and approval remain mandatory. Editing geometry invalidates approval; late and mismatched responses cannot restore it. Local blueprints from an older generator are marked for review, and saving them acknowledges the new geometry. Their existing approval cannot be reused.
- Detailed stateful plans require **operator command placement**. Creative hand placement still supports its existing stateless operations, but refuses stateful architecture before mutation rather than silently building incorrectly oriented blocks. The connected server must support every requested block.
- The command adapter checks properties as well as block names, verifies every sent cell rather than a twelve-cell sample, and reports confirmed cells rather than command counts. It rechecks loaded/protected targets before each command. A permission probe uses `/seed` and never clears a block.
- Undo records previous block properties and restores them only where the current world still matches the recorded replacement. Protection, authorization, explicit approval and cancellation remain enforced. Server ticks, neighbour updates and player edits can cause verification failures; those are reported rather than declared successful.

## Verification scope

Local validation: 81 Node unit/integration tests; 10 Playwright browser cases (including the seven real editor captures and 320/393/430-pixel layouts); mobile and desktop TypeScript checks; root and desktop production builds; Expo iOS, Android and web exports; Expo Doctor 21/21. The desktop WebGL capture completed without browser runtime errors.

| Showcase | Original solid cells | Enhanced solid cells | Enhanced operations |
| --- | ---: | ---: | ---: |
| Lakeside Cottage | 295 | 2,234 | 2,790 |
| Starter Survival Cottage | 277 | 1,537 | 2,006 |
| Rustic Oak Cabin | 262 | 2,004 | 2,693 |
| Forest Treehouse | 147 | 2,607 | 2,856 |
| Medieval Stone Keep | 526 | 4,587 | 5,780 |
| Cliffside Mountain House | 373 | 2,345 | 2,912 |
| Modern Glass Villa | 486 | 2,567 | 3,656 |

Each figure counts unique final coordinates, not duplicate decorative writes. Operation counts additionally include deliberate air cells that clear interior space. The increase includes foundations and landscaping as well as the visible architectural components; the comparisons show the shape change rather than relying on counts alone.

Automated coverage includes deterministic fingerprints, actual solid-cell growth against the seven originals, unique coordinates, complete door pairs, valid block properties, bounds, resize limits, rotation/mirroring, material changes, floating offsets, approval invalidation, all 50 distinct identities, state-aware undo and a simulated command adapter that refuses to report success when the world never changes. Existing authentication, pairing, ownership, entitlement, cancellation and UI tests remain part of the regression suite.

**Real Minecraft placement is unverified.** No compatible local test server was listening during this implementation. The adapter test is a simulation, not evidence of a Minecraft build. Before production use, test a disposable Java 1.21.1 world with an operator bot, inspect each structure after neighbour updates, and verify cancellation/undo there. Browser screenshots show the running Expo web application at phone dimensions; they are not physical-iPhone captures. An iOS bundle export checks packaging but does not replace device testing.

## Data attribution

The block/property registry is derived from [PrismarineJS minecraft-data](https://github.com/PrismarineJS/minecraft-data), distributed under MIT; the installed Node package version is 3.115.0. The upstream README notes that some data was extracted from wiki.vg and minecraft.gamepedia.com. No upstream textures, logos or game audio are included. The project's new procedural material colors/textures and architectural code are original source additions.
