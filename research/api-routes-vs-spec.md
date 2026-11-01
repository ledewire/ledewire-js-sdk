# API routes vs OpenAPI spec

Resolves ledewire/ledewire-js-sdk#70 (parent map #67). Researched 2026-11-01.

## Question

Does `docs/api/v1/ledewire.yml` cover every route the API serves?

## Method and sources

- Routes: `config/routes.rb` and `config/routes/admin.rb` (drawn via `draw(:admin)`) in `ledewire/api` at `origin/staging` (`8d0afc18`). The launch stack's container was down, so `bin/rails routes` was not run; routes were expanded by hand from the DSL (`resources`, `scope`, `namespace`, `member`/`collection`).
- Spec: `docs/api/v1/ledewire.yml` at `origin/staging`. `config/routes*` and the spec are byte-identical on `main` and `staging` (empty `git diff`).
- Both sides were normalised to `(METHOD, path with params as {})` and diffed with a python3 script (not committed).

## Result

- **(a) Client-facing routes not in the spec: none.**
- **(b) Documented paths not routed: none.** All 98 spec paths resolve to a route. Every `/v1/*`, `/oauth/*` and `/.well-known/*` path in the spec is routed, and the reverse also holds.
- The retired `/v1/seller/{buyers,config,sales,sales/summary}` routes are gone from both routes and spec. Only `/v1/seller/content*` remains in both. This confirms the map's note that `@ledewire/node`'s `resources/seller/` targets routes the API no longer serves.

### Minor discrepancies (not gaps worth an SDK ticket)

1. **PUT aliases.** Rails `resources ... only: [:update]` also routes `PUT` next to `PATCH`. The spec documents `PATCH` only, for `/v1/seller/content/{id}`, `/v1/merchant/{store_id}/content/{id}`, `/v1/merchant/{store_id}/users/{id}`, and `/v1/user/spend-cap` (`resource ... only: [:show, :update]`). The SDK should use `PATCH`. Not worth documenting.
2. **Ahoy.** `/ahoy/visits` and `/ahoy/events` are documented in the spec but not in `routes.rb`. They come from the `ahoy_matey` engine (`Ahoy.api = true`, `config/initializers/ahoy.rb`). I did not boot the app, so they are unverified as routed. They are analytics beacons and not-for-SDK.
3. **MCP.** `GET` and `DELETE /v1/mcp` are routed only to return 405 (#1448). The spec documents them. Fine.

### Out of scope for SDK, still listed

| Route | Spec | Note |
|---|---|---|
| `/oauth/register`, `/oauth/authorize` (GET, POST), `/oauth/authorize/google`, `/oauth/token`, `/oauth/revoke` | yes | OAuth server |
| `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/v1/mcp` | yes | OAuth metadata |
| `/.well-known/x402-jwks.json`, `/.well-known/ledewire-signing-keys.json` | yes | Key material. The x402 JWKS may matter to `@ledewire/x402-client`, which can verify offline. |
| `POST /v1/mcp`, `GET`/`DELETE /v1/mcp`, `/v1/mcp/keys` (GET, POST), `DELETE /v1/mcp/keys/{id}` | yes | MCP transport. Note `/v1/mcp/keys` is a key-management REST API and is not protocol. It is the only part an SDK might want, and the map's out-of-scope list covers `/v1/mcp` only. |

### Admin, internal, health: not-for-SDK, not in the spec (correctly)

- `config/routes/admin.rb`, HTML Administrate under `/admin`: `stores` (plus `assign_owner`, `generate_api_key`), `users`, `companies` (plus `invite_admin`, invitations, subscriptions), `usage`, `publication_topics` (plus export, apply, uploads, edit), `api_keys`, `author_payouts`, `contents`, `platforms`, `store_users`.
- `/audit` (`events#index`, session new/create/destroy): audit-log viewer behind Google SSO.
- `/signup` (merchant invite HTML page), `/docs` and `/docs/*path` (customer guides), `/api-docs` (Rswag UI and spec), `/letter_opener` (development only).
- `/up` and `/health`: health checks.

## Candidate API issues (not filed)

No spec-versus-route gap exists, so nothing is needed from the SDK's side. Optional hardening:

1. `test(api): Fail CI when a /v1 route is missing from ledewire.yml` (and the reverse). This would keep the zero-gap result true. An allowlist covers admin, audit, docs and health.
2. `docs(api): Note that PUT is not supported on update routes` or `refactor(routes): Route updates as PATCH only`. Low value. The spec is silent today and the SDK should use `PATCH` regardless.
