# LedeWire JavaScript SDK — Big Picture Overview

> **Status:** Reference architecture — all phases shipped (v0.1.0)
> **Last updated:** 2026-03-10
> **Authors:** LedeWire Engineering

---

## 1. Vision & Goals

The LedeWire JS SDK lowers the barrier for developers — and AI coding agents — to integrate with the LedeWire API. There are two fundamentally different integration patterns this SDK must serve:

| Pattern              | Who uses it                       | How they use it                                                                                                                                       |
| -------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embedded Paywall** | A site owner publishing content   | Drop a `<script>` tag on any site, pass an API key, and immediately enable user auth, wallet funding, and content purchasing — no build step required |
| **Merchant Store**   | A developer building a full store | Install an npm package, get the full API surface for managing content, authors, sales reporting, buyer management, and store configuration            |

Both patterns require high confidence in correctness (automated tests, type safety), minimal boilerplate for the consumer, and documentation that works equally well for a human reading a guide and an AI agent reading type definitions.

---

## 2. Repository Architecture

The project lives in a single **monorepo** (one GitHub repo, multiple publishable packages). This is the standard approach for SDKs that share code across packages.

```
ledewire-js-sdk/
├── packages/
│   ├── core/          # Shared: HTTP client, token manager, types, error classes
│   ├── browser/       # CDN bundle — buyer-focused (auth, content, wallet, purchases)
│   └── node/          # npm package — full API surface (merchant + seller + buyer)
├── docs/              # Docusaurus documentation site
├── .github/
│   └── workflows/     # CI/CD pipelines
├── package.json       # Workspace root (pnpm workspaces)
├── turbo.json         # Build orchestration
└── OVERVIEW.md        # (this file)
```

### Future packages (not in scope for v1, but designed for)

```
packages/
├── react/             # React hooks wrapping browser or node packages
└── vue/               # Vue composables
```

### Monorepo tooling

- **pnpm workspaces** — fast, strict dependency management
- **Turborepo** — incremental build/test/lint with caching; ensures packages build in dependency order

---

## 3. Package Design

### 3.1 `packages/core` — Internal shared foundation

> **Not published to npm.** Only used internally by `browser` and `node`.

Responsibilities:

- TypeScript type definitions generated from `ledewire.yml` (the OpenAPI spec)
- Base HTTP client abstraction (fetch-based, works in both browser and Node ≥18)
- Token lifecycle manager (storage adapter interface, proactive + reactive refresh)
- Error class hierarchy
- Request/response interceptor pipeline

This layer is the backbone. All business logic in `browser` and `node` is built on top of it.

### 3.2 `packages/browser` — `@ledewire/browser`

> **Published to npm** as `@ledewire/browser`
> **Also released as a UMD/IIFE bundle** via GitHub Releases → available on jsDelivr CDN

**Audience:** Site owners who want to add a paywall to existing content with zero build tooling.

**API surface (buyer flows only):**

- Authentication: email/password signup & login, Google OAuth login, token refresh, password reset
- Checkout state machine: `authenticate → fund_wallet → purchase → view_content`
- Content: fetch content with access info, check access state
- Wallet: get balance, create payment session, poll payment status, transaction history
- Purchases: create purchase, list purchases, verify purchase

**CDN usage (the primary use case):**

```html
<script src="https://cdn.jsdelivr.net/npm/@ledewire/browser@1/dist/ledewire.min.js"></script>
<script>
  const lw = Ledewire.init({ apiKey: 'your_api_key' });

  // Check if current user can read an article
  const state = await lw.checkout.state('content-id-123');
  // state.next_required_action → 'authenticate' | 'fund_wallet' | 'purchase' | 'view_content'
</script>
```

**npm/bundler usage:**

```js
import { createBrowserClient } from '@ledewire/browser'
const lw = createBrowserClient({ apiKey: 'your_api_key' })
```

**Token storage:** Tokens are stored in **memory by default**. An optional `storage` adapter can be passed (e.g., `localStorage` adapter for persistence across page loads). The adapter interface is intentionally simple so React/Vue wrappers can inject their own state management later.

### 3.3 `packages/node` — `@ledewire/node`

> **Published to npm** as `@ledewire/node`
> Supports both **ESM** (`import`) and **CJS** (`require`) via dual package exports

**Audience:** Developers building merchant stores, server-side integration, automation, and backend services.

**API surface (complete):**

- Everything in `browser`, plus:
- Merchant auth: email/password, Google OAuth, store listing
- Merchant user management: invite, list, remove team members
- Content management (CRUD): create/update/delete content, search
- Sales & reporting: sales list, sales summary, buyer list
- Store configuration
- Webhook processing helpers

**Usage:**

```js
import { createClient } from '@ledewire/node';

// Seller / store operations (API key auth)
const client = createClient({ apiKey: 'key', apiSecret: 'secret' });
const content = await client.seller.content.create({ title: 'My Article', ... });

// Merchant operations (email/password auth)
const merchant = await createClient().merchant.loginWithEmail({ email, password });
const sales = await merchant.sales.list({ storeId: 'store-id' });
```

**Token storage:** In-memory by default. The client emits a `tokenRefreshed` event so server applications can persist the new token to their own storage (database, Redis, etc.) without being coupled to any particular persistence mechanism.

---

## 4. Token Lifecycle Management

This is handled **automatically and transparently** by the `core` token manager. Consumers do not call refresh manually.

```
Request → [Is token expiring in < 60s?] → Yes → Proactively refresh first → Continue
                          ↓ No
               [Send request]
                          ↓
               [Got 401?] → Yes → Attempt refresh once → Retry original request
                          ↓ No
               [Return response]
```

**Key decisions:**

- Proactive refresh threshold: 60 seconds before expiry (configurable)
- If refresh fails, the error is thrown to the caller — they can re-authenticate
- The browser client will emit an `authExpired` event to let the UI prompt re-login
- The node client will emit a `tokenRefreshed` event so applications can persist the new token

---

## 5. Error Handling Strategy

### Phase 1 (v1.x): Single error class

Every API error throws a `LedewireError` with:

- `message` — human-readable description
- `statusCode` — HTTP status code (400, 401, 403, 404, 422, etc.)
- `code` — machine-readable error code from the API

```js
try {
  await lw.purchases.create({ contentId: '...' })
} catch (err) {
  if (err instanceof LedewireError && err.statusCode === 400) {
    // Handle insufficient funds, already purchased, etc.
  }
}
```

### Phase 2 (future): Typed error subclasses

```js
import { AuthError, InsufficientFundsError, PriceMismatchError } from '@ledewire/node';

try {
  await client.purchases.create({ contentId: '...' });
} catch (err) {
  if (err instanceof InsufficientFundsError) { ... }
  if (err instanceof PriceMismatchError) { ... }
}
```

The Phase 1 design is intentionally structured so Phase 2 is a non-breaking additive change — subclasses of `LedewireError` are still `instanceof LedewireError`.

---

## 6. Type Safety

The entire SDK is written in **TypeScript with strict mode**. Types are:

- Derived from the OpenAPI spec (`ledewire.yml`) using code generation (via `openapi-typescript`)
- Refined by hand where the generated types are too broad
- Exported as part of each package so TypeScript consumers get full intellisense

JavaScript consumers also benefit through the bundled `.d.ts` files and JSDoc in the source — VS Code and other editors surface types and parameter documentation without the consumer needing TypeScript.

---

## 7. Documentation Strategy

Small team → automation is the documentation strategy.

| Layer                 | Tool                      | Audience                         | Auto-generated?       |
| --------------------- | ------------------------- | -------------------------------- | --------------------- |
| Inline types & JSDoc  | TypeDoc                   | IDE intellisense + API reference | Generated from source |
| API Reference site    | TypeDoc → GitHub Pages    | Developers & AI agents           | Fully automated       |
| Guides & tutorials    | Docusaurus → GitHub Pages | Human developers                 | Hand-written, minimal |
| Code examples         | `examples/` directory     | Developers & AI agents           | Hand-written          |
| Machine-readable spec | `ledewire.yml` (linked)   | AI agents                        | Already exists        |

**Docusaurus** will host both auto-generated API reference (TypeDoc output embedded) and hand-written guides under a single domain. The site starts on GitHub Pages and will migrate to `https://docs.ledewire.org` when ready. The docs site is rebuilt and deployed automatically on every release.

**AI agent friendliness** is achieved by:

- Complete JSDoc on every exported function, class, and type (required in CI)
- A `llms.txt` file at the repo root listing the key files, their purposes, and usage patterns
- An `AGENTS.md` (or `.github/copilot-instructions.md`) with SDK architecture context for coding agents

---

## 8. Testing Strategy

```
                  ┌─────────────────────────────┐
                  │   Integration tests          │  ← Against staging API (CI only)
                  │   (Vitest + real HTTP)       │
                  ├─────────────────────────────┤
                  │   API boundary tests         │  ← Vitest + MSW (mocked HTTP)
                  │   (request shape, auth flow) │
                  ├─────────────────────────────┤
                  │   Unit tests                 │  ← Vitest, fast, no I/O
                  │   (token manager, errors,    │
                  │    response parsing)         │
                  └─────────────────────────────┘
```

| Tool                          | Purpose                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Vitest**                    | Test runner for all layers (fast, ESM-native, great TypeScript support)                                           |
| **MSW (Mock Service Worker)** | Intercepts HTTP at the network level for realistic boundary testing — works in both Node and browser environments |
| **c8 / Istanbul**             | Coverage reporting; CI fails below **90% line coverage**                                                          |
| **Playwright**                | Optional E2E tests for the browser bundle against a real browser (CDN integration scenario)                       |

All tests run in CI on every push. Integration tests against staging run nightly and on release branches only.

---

## 9. Code Quality & Security

| Tool                            | Role                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| **ESLint + @typescript-eslint** | Linting — enforces consistent patterns and catches common mistakes        |
| **Prettier**                    | Formatting — eliminates style debates                                     |
| **TypeScript strict mode**      | Catches type errors at compile time                                       |
| **Dependabot**                  | Automated weekly PRs for dependency updates                               |
| **GitHub CodeQL**               | Static analysis for security vulnerabilities                              |
| **`pnpm audit`**                | Fails CI if high/critical vulnerabilities exist in dependencies           |
| **`publint`**                   | Validates that published packages are correctly structured before release |

---

## 10. Release & Distribution Pipeline

### Versioning: Changesets

[Changesets](https://github.com/changesets/changesets) is the standard monorepo release tool. Workflow:

1. Developer opens a PR and runs `pnpm changeset` to describe what changed (patch/minor/major)
2. A **"Version Packages" PR** is automatically opened and kept up to date by a GitHub Action
3. Merging that PR triggers the release pipeline

### Release pipeline (GitHub Actions)

```
Merge to main
     │
     ▼
Build all packages (Turborepo cache)
     │
     ▼
Run full test suite
     │
     ├── Tests pass → Determine if Version PR was merged
     │                       │
     │                       ▼
     │               Publish @ledewire/browser → npm (public)
     │               Publish @ledewire/node    → npm (public)
     │               Attach browser IIFE bundle → GitHub Release
     │               Deploy API docs            → GitHub Pages
     │               Deploy Docusaurus site     → GitHub Pages
     │
     └── Tests fail → Block release, notify
```

### CDN availability

Once `@ledewire/browser` is on npm, the IIFE bundle is immediately available (no extra work) via:

```
https://cdn.jsdelivr.net/npm/@ledewire/browser@latest/dist/ledewire.min.js
https://unpkg.com/@ledewire/browser@latest/dist/ledewire.min.js
```

Pinning to a major version (recommended for production) is:

```
https://cdn.jsdelivr.net/npm/@ledewire/browser@1/dist/ledewire.min.js
```

---

## 11. GitHub Repository Structure

```
.github/
├── workflows/
│   ├── ci.yml             # Run on every PR: build, lint, test, type-check, audit
│   ├── release.yml        # Run on main: publish packages, deploy docs
│   ├── nightly.yml        # Nightly: integration tests against staging
│   └── codeql.yml         # Weekly: security analysis
├── AGENTS.md              # Context for AI coding agents working in this repo
└── CONTRIBUTING.md        # How to develop, test, and submit changes
```

---

## 12. v1 Scope Boundaries

**In scope for v1:**

- [ ] `packages/core`: HTTP client, token manager, types from spec, `LedewireError`
- [ ] `packages/browser`: All buyer flows, IIFE bundle, CDN-ready
- [ ] `packages/node`: Full API surface, ESM + CJS
- [ ] CI pipeline: lint, type-check, test, audit
- [ ] Release pipeline: npm publish, GitHub Release, docs deploy
- [ ] TypeDoc API reference site on GitHub Pages
- [ ] Minimal Docusaurus site with getting-started guides for both use cases
- [ ] `examples/` directory with working minimal examples for each use case

**Out of scope for v1 (designed for, not built):**

- `@ledewire/react` — React hooks
- `@ledewire/vue` — Vue composables
- Typed error subclasses (beyond base `LedewireError`)
- E2E Playwright tests
- Server-side rendering (SSR) specific patterns

---

## 13. Design Decisions

| #   | Decision                          | Resolution                                                                                                        |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | npm org / scope                   | `@ledewire/` scoped packages confirmed — `@ledewire/browser` and `@ledewire/node`                                 |
| 2   | Docs domain                       | GitHub Pages initially; migrate to `https://docs.ledewire.org` when ready                                         |
| 3   | Browser token persistence default | Memory-only default; opt-in `localStorageAdapter` helper exported from `@ledewire/browser`                        |
| 4   | Google OAuth in browser SDK       | SDK accepts a `id_token` string from the caller — site owner is responsible for obtaining it via Google's own SDK |
| 5   | Package versioning                | `@ledewire/browser` and `@ledewire/node` version independently via Changesets                                     |

---

## 14. Suggested Build Order

1. **Scaffold monorepo** — pnpm workspaces, Turborepo, ESLint, Prettier, TypeScript config
2. **Generate types** — run `openapi-typescript` on `ledewire.yml`, review/refine output
3. **Build `core`** — HTTP client, token manager, `LedewireError`
4. **Build `node`** — implement all endpoints, full test suite with MSW
5. **Build `browser`** — implement buyer subset, build IIFE bundle
6. **CI pipeline** — lint, test, coverage gate, security audit
7. **Docs** — TypeDoc config, minimal Docusaurus skeleton with getting-started guides
8. **Release pipeline** — Changesets, npm publish, GitHub Pages deploy
9. **Examples** — working minimal examples for each primary use case
10. **AGENTS.md + llms.txt** — AI agent context files
