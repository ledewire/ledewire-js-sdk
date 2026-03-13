---
'@ledewire/browser': patch
'@ledewire/node': patch
---

Fix TypeScript type declarations leaking unpublished `@ledewire/core` dependency

`dist/index.d.ts` in both packages contained `import`/`export … from '@ledewire/core'` statements. Because `@ledewire/core` is a private internal package not published to npm, TypeScript consumers could not resolve these types, causing:

- All re-exported types (`LedewireError`, `AuthError`, `StoredTokens`, etc.) resolving to `any`
- `instanceof LedewireError` checks not narrowing the catch variable (`TS18046`)
- `TokenStorage` callback parameters implicitly typed as `any` (`TS7006`)

Both packages now produce fully self-contained declaration files with all `@ledewire/core` types inlined. Runtime behaviour is unchanged.
