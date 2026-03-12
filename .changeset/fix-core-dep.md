---
'@ledewire/browser': patch
'@ledewire/node': patch
---

fix: move @ledewire/core to devDependencies

@ledewire/core is a private, internal package that is fully bundled into the
output of @ledewire/browser and @ledewire/node at build time. Having it listed
under `dependencies` caused npm/yarn/pnpm consumers to receive an unresolvable
package error on install, since @ledewire/core is never published to the registry.
