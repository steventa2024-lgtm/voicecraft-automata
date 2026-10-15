# License audit

**Status:** recommendation only. No root `LICENSE` file is added by this note. The owner has not chosen a license. A public GitHub repository is not automatically open source.

## What is in the tree

The repository contains original application code for the website, desktop app, mobile companion, cloud API, and Minecraft bridge. Existing copyright notices in third-party files and dependency packages stay as they are.

Direct product dependencies include permissive licenses that are compatible with several outbound choices:

- MIT appears on React, React Native, Expo modules used here, Supabase client libraries, Electron, and mineflayer.
- Apache-2.0 appears on parts of the AWS SDK already used by the website. Apache-2.0 includes a patent grant and requires that notices be kept.
- Minecraft itself is not open source. Running a server still requires Mojang's EULA. VoiceCraft does not redistribute the Minecraft client or server jar as its own work. The Docker profile downloads Mojang's server when an operator sets `EULA=TRUE`.

No dependency review in this pass found a requirement that the whole repository be GPL. That is not a complete legal opinion. Before publishing a license, the owner should re-check `node_modules` notices and any asset whose author is not the project owner.

## Recommendation

**Apache-2.0** is the better fit if the owner wants a permissive license with an explicit patent grant and a requirement to keep notices. It matches the AWS SDK pieces already in the website and still allows the existing paid Stripe subscriptions to stay in the product.

**MIT** is the simpler alternative. It is the license most of the JavaScript stack already uses. It does not include Apache's patent grant. It is appropriate if the owner wants the shortest, most familiar terms.

**GPL-family licenses** would require derivative works to use the same copyleft terms. That fights the current shape of the product: a public website with proprietary billing, an Electron desktop app, and a mobile client the owner may later ship through store accounts. GPL is not recommended unless the owner wants that copyleft on purpose.

## What not to do yet

Do not add `LICENSE`, `COPYING`, or SPDX headers that claim a license until the owner picks one. Do not remove existing copyright notices from dependencies. Do not describe the repository as "MIT licensed" or "Apache licensed" in the README before that choice.
