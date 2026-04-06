# Agentic Content Delivery — x402 at the Origin

**Status:** Design — Strategy Phase
**Date:** 2026-04-01
**Related:**

- [docs/x402-wallet-payment-design.md](x402-wallet-payment-design.md) — x402 protocol implementation (implemented)
- [docs/js-gate-design.md](js-gate-design.md) — content registration infrastructure (in progress)

> **Note:** This document supersedes the "Potential Future Efforts" section of
> [x402-wallet-payment-design.md](x402-wallet-payment-design.md) (Cloudflare Worker,
> Docker/Caddy proxy, and Browser Extension designs described there are covered here
> with more detail and a clearer sequencing rationale).

---

## Table of Contents

1. [Objective](#objective)
2. [The Problem: Agents Hit Origin URLs](#the-problem-agents-hit-origin-urls)
3. [How the Pieces Fit Together](#how-the-pieces-fit-together)
4. [Delivery Mechanisms](#delivery-mechanisms)
5. [Content Discovery: The Bazaar](#content-discovery-the-bazaar)
6. [Customer Validation Questions](#customer-validation-questions)
7. [Prerequisite Work](#prerequisite-work)
8. [LLM Agent Stack](#llm-agent-stack)
9. [Roadmap](#roadmap)

---

## Objective

Enable store owners to monetise their existing content for **agentic consumption**
(AI agents, RAG pipelines, LLM web browsing, automated workflows) using Ledewire
as the payment rail — with minimal integration effort from the store owner and
zero changes required to the origin content server.

A store owner should be able to do the following and have their content purchasable
by any x402-aware agent:

1. Verify they own their domain (one-time, DNS TXT record)
2. Create a URL pattern pricing rule in the Ledewire dashboard
3. Add a delivery mechanism (Cloudflare Worker, CMS plugin, or proxy)

Once in place, any agent that encounters that content and speaks x402 will
automatically purchase it through Ledewire using the `ledewire-wallet` scheme,
with no human in the loop.

---

## The Problem: Agents Hit Origin URLs

The Ledewire x402 endpoint (`GET /v1/x402/contents/:id`) works today, but it
requires the calling client to know that the content is on Ledewire. An AI agent
crawling the web encounters `https://blog.example.com/posts/great-article` — not
a Ledewire API URL. The agent has no reason to know Ledewire exists, and no
mechanism to initiate payment.

For agentic x402 to work, **the `402 Payment Required` response must be served at
the origin URL** — the URL the agent already intends to fetch. That requires
some layer between the agent and the origin content server to intercept the request
and issue the x402 challenge.

```
Today:                      Desired:

Agent                        Agent
  │                            │
  ├──► api.ledewire.com        ├──► blog.example.com
  │    /v1/x402/contents/:id   │    /posts/great-article
  │    (agent must know this   │    ◄── 402 Payment Required
  │     URL in advance)        │         PAYMENT-REQUIRED: { ledewire-wallet, ... }
  │                            │
  │                            ├──► blog.example.com (with PAYMENT-SIGNATURE)
                               │    ◄── 200 + content
```

The `ledewire-wallet` scheme, JWKS endpoint, and `accessToken` are all already
implemented server-side. The missing piece is the **interception layer** at the
origin that issues the `402`.

---

## How the Pieces Fit Together

This effort is built on two foundations that are either complete or in active
development:

### Already complete (server-side prerequisites)

| Capability                          | What it enables                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `resource_url` on `Content`         | Binds a Ledewire content record to an origin URL                                            |
| `accessToken` in `PAYMENT-RESPONSE` | Offline entitlement proof; proxy/CMS verifies without calling Ledewire                      |
| `GET /.well-known/x402-jwks.json`   | Any third-party proxy verifies `accessToken` signatures offline                             |
| `GET /v1/x402/verify-origin?url=`   | Confirms a URL is registered Ledewire content; used by proxies/extensions for anti-phishing |

### In progress (js-gate-design.md Phase 1)

| Capability                                              | What it enables                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ContentPricingRule` (URL pattern → price)              | Lazy registration of content records on first hit; store owner sets price once for an entire URL pattern |
| `StoreDomainVerification` (DNS TXT)                     | Proves domain ownership; prevents malicious stores from claiming rules over domains they don't own       |
| Extended `verify-origin` (lazy registration)            | First agent request to an unregistered but rule-matched URL automatically creates the Content record     |
| `GET /v1/x402/discovery/resources` (Bazaar — see below) | Makes gated content discoverable to x402-aware agents and directories                                    |

Once `ContentPricingRule` is in place, a store owner's pricing rule for
`https://blog.example.com/posts/*` means **every matching URL is automatically
an x402-gated resource** from the agent's perspective — no per-article dashboard
work required.

---

## Delivery Mechanisms

The interception layer can be implemented in several ways, each with different
trade-offs. All of them use the same Ledewire API additions already built.

### Option A — Cloudflare Worker (recommended first target)

A Worker sits in front of the origin and handles the full x402 conversation:

```
Agent
  │
  ▼
┌─────────────────────────────────────────────┐
│  Cloudflare Worker (store owner's zone)     │
│                                             │
│  No PAYMENT-SIGNATURE:                      │
│    → GET /v1/x402/verify-origin?url=...     │
│    → 402 + PAYMENT-REQUIRED (ledewire-wallet│
│         scheme, price from pricing rule)    │
│                                             │
│  Valid PAYMENT-SIGNATURE:                   │
│    → verify accessToken via JWKS (offline)  │
│    → forward clean request to origin        │
└─────────────────────────────────────────────┘
  │
  ▼
Origin (unmodified WordPress / Ghost / static site)
```

**Store owner setup:** add one Worker script to their Cloudflare zone. The Worker
is a static, versioned script distributed by Ledewire — the store owner provides
their `data-api-key` as an environment variable.

**Why this is the right first target:**

- ~40% of the web already runs behind Cloudflare
- Zero changes to the origin server
- `accessToken` verification is fully offline (RS256 + JWKS) — no Ledewire API call
  on the hot path after the first JWKS fetch
- Worker runtime is ~100 lines of TypeScript
- Can gate requests from both agents (x402) and browsers (redirects to `@ledewire/gate` embed flow)

**What Ledewire ships:**

- A versioned, installable Worker script (distributed via npm or Cloudflare Workers Registry)
- A dashboard UI to copy a `wrangler.toml` snippet pre-populated with the store's API key

**See [cloudflare-worker-design.md](cloudflare-worker-design.md) for the full implementation design.**

### Option B — CMS Plugin (Ghost, WordPress)

A server-side plugin intercepts requests before the CMS renders:

- Unauthenticated GET → return `402` + `PAYMENT-REQUIRED` header
- GET with valid `accessToken` (cookie or header) → verify offline via JWKS → serve normally

Requires installation on the publisher's server. Best suited for publishers who
can't or won't use Cloudflare, but who manage their own CMS instance.

**Sequencing:** design the Cloudflare Worker first. The CMS plugin is the same
logic packaged differently — once the Worker is stable the plugin is a port.

### Option C — Ledewire-Hosted Reverse Proxy (managed tier)

Store owner points their domain (or a subdomain) at a Ledewire-operated reverse
proxy. Ledewire handles everything; zero setup for the store owner.

**Trade-off:** Ledewire becomes load-bearing infrastructure in every page request.
Significant operational cost; single point of failure. Appropriate as a premium
managed tier only, not the primary path.

### Option D — Edge Middleware (Vercel, Netlify, AWS Lambda@Edge)

Same logic as the Cloudflare Worker but targeting publishers on these platforms.
Implementation is essentially identical; the distribution mechanism differs.
**Phase 2 follow-on** once the Worker is proven.

### Comparison

| Option                      | Store-owner effort          | Origin changes? | Covers agents? | Covers browsers?       |
| --------------------------- | --------------------------- | --------------- | -------------- | ---------------------- |
| Cloudflare Worker           | Low (1 wrangler.toml)       | None            | ✅             | ✅ (redirect to embed) |
| CMS Plugin                  | Medium (install + activate) | None            | ✅             | ✅                     |
| Ledewire Proxy              | Very low (DNS CNAME)        | None            | ✅             | ✅                     |
| Edge Middleware             | Low                         | None            | ✅             | ✅                     |
| `@ledewire/gate` embed only | Very low (1 script tag)     | None            | ❌             | ✅                     |

---

## Content Discovery: The Bazaar

For an agent to know that a URL requires payment before fetching it, there needs
to be a discovery mechanism. The x402 v2 specification defines this: the **Bazaar**
(`GET /discovery/resources`) — a centralised directory of x402-enabled resources.

Ledewire should implement this as `GET /v1/x402/discovery/resources`, automatically
populated from `ContentPricingRule` records as store owners create them:

```
GET /v1/x402/discovery/resources?type=http&limit=20

{
  "x402Version": 2,
  "items": [
    {
      "resource": "https://blog.example.com/posts/great-article",
      "type": "http",
      "x402Version": 2,
      "accepts": [{
        "scheme": "ledewire-wallet",
        "network": "ledewire:v1",
        "amount": "100",
        "asset": "USD",
        "payTo": "store:<uuid>"
      }],
      "lastUpdated": 1743465600,
      "metadata": {
        "category": "publishing",
        "provider": "Example Blog",
        "preview": "Ledewire's x402 implementation uses a nonce-based challenge..."
      }
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "total": 1432 }
}
```

**Why this matters for agentic adoption:** x402-aware agent orchestration
frameworks (LangChain, CrewAI, custom RAG pipelines) can query the Bazaar to
pre-discover what content is available and at what price, before attempting to
fetch it. This reduces surprise `402` responses and enables budget-aware agents
to plan purchases.

**Implementation cost:** low. The Bazaar is a paginated read endpoint over
`ContentPricingRule` + lazily-registered `Content` records. No new data model
required; it's a view over data that Phase 1 of js-gate-design already creates.

---

## Customer Validation Questions

_Answered through initial customer conversations, April 2026._

1. **Do target customers already use Cloudflare?**
   ✅ **Yes** — our initial customer is already on Cloudflare. The Worker-first
   delivery strategy is confirmed as the right first target.

2. **What is the primary agent type they expect to serve?**
   ✅ **LLM web browsing** (OpenAI, Perplexity, and similar). The goal is not
   merely to block agents at paywalls — it is to give agents a mechanism to
   complete the purchase. This makes `@ledewire/x402-client` and the
   `ledewire-wallet` scheme discovery extension the highest-leverage investments:
   an LLM browser agent that hits a `402` should be able to resolve it
   automatically, not fail with an opaque payment error.

3. **What does the store owner's publishing stack look like?**
   ✅ **Widely varying** — confirmed. Stack-agnosticism is essential, which is
   exactly why the Cloudflare Worker is the right first target. CMS plugins follow
   once the Worker is proven.

4. **How do store owners think about agent pricing vs. human pricing?**
   ✅ **Same price for now; may deviate in the future.** The current
   `ContentPricingRule` model applies one price per URL pattern to all purchase
   types. Differential pricing is explicitly tracked as a future requirement.
   The `ContentPricingRule` schema should be designed to accommodate a future
   `agent_price_cents` column without a breaking migration — avoid hardcoding
   a parity assumption.

5. **Is the Bazaar discovery mechanism valuable to them?**
   ✅ **Yes — in preview form.** The analogy given was a white paper's abstract:
   agents should be able to read a short excerpt before deciding whether to pay.
   This is a meaningful improvement over a hard paywall — a budget-aware agent
   can evaluate relevance before committing funds. Implications:
   - The `Content` model needs a `preview` column (short text excerpt, nullable,
     set by the store owner in the dashboard)
   - The Bazaar endpoint should include `preview` in each item's `metadata`
   - The `PAYMENT-REQUIRED` header's `resource.description` should carry the
     preview when available, so agents see it on first `402` without querying
     the Bazaar separately
   - The Worker's `build402Response` should forward `preview` from
     `VerifyResult` into `resource.description`

6. **What does the trial/activation journey look like?**
   ✅ **Active effort** — this is a current priority. The 15-minute onboarding
   target stands as the design constraint for all setup flows.

---

## Prerequisite Work

All critical blockers for the Cloudflare Worker are implemented. Work on the Worker
can proceed immediately.

| Prerequisite                                 | Status  | Why it was needed                                                         |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `ContentPricingRule` model + migration       | ✅ Done | Source of truth for which URLs to gate and at what price                  |
| `StoreDomainVerification`                    | ✅ Done | Prevents malicious stores from claiming rules over domains they don't own |
| Extended `verify-origin` (lazy registration) | ✅ Done | Worker calls this to confirm a URL is gated before issuing a `402`        |

Non-blocking items still to land:

| Item                                        | Status                                                     |
| ------------------------------------------- | ---------------------------------------------------------- |
| `accessToken` in `PAYMENT-RESPONSE`         | ✅ Done                                                    |
| `GET /v1/x402/discovery/resources` (Bazaar) | Deferred — lower priority while Worker is the active focus |

---

## LLM Agent Stack

For an LLM agent to buy content with zero configuration, every layer of the stack
must work. This section maps what is already in place against what still needs to
be built.

### What exists today

| Capability                   | Endpoint / artefact                     | Notes                                                                                                                                                                         |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x402 payment endpoint        | `GET /v1/x402/contents/:id`             | Issues `402 PAYMENT-REQUIRED` or settles payment                                                                                                                              |
| Worker gate                  | `ledewire-gateway` (design complete)    | Issues `402` at origin URL; verifies `accessToken` offline                                                                                                                    |
| Seller auth via API key      | `POST /v1/auth/login/api-key`           | Returns **store JWT** — for merchant/seller use only                                                                                                                          |
| JWKS                         | `GET /.well-known/x402-jwks.json`       | Allows offline `accessToken` verification anywhere                                                                                                                            |
| Origin verification          | `GET /v1/x402/verify-origin?url=`       | Worker uses this to confirm URL is a gated resource                                                                                                                           |
| Buyer email auth             | `POST /v1/auth/login/email`             | Returns buyer JWT; requires username + password                                                                                                                               |
| **Buyer API key auth**       | **`POST /v1/auth/login/buyer-api-key`** | **Returns buyer JWT from named, revocable API key + secret; `api_key_id` embedded in JWT for per-key spend tracking; see [buyer-api-key-design.md](buyer-api-key-design.md)** |
| **Buyer API key management** | **`GET/POST/DELETE /v1/user/api-keys`** | **List, create, and revoke buyer API keys; secret shown once at creation**                                                                                                    |

### What still needs to be built

| Item                                                                   | Priority | Notes                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`UserApiKey` model + `POST /v1/auth/login/buyer-api-key` endpoint~~  | ✅ Done  | See [buyer-api-key-design.md](buyer-api-key-design.md)                                                                                                                                                |
| `@ledewire/x402-client` TypeScript library                             | **High** | Wraps `@x402/fetch`; handles `ledewire-wallet` scheme, buyer auth, `PAYMENT-SIGNATURE` construction                                                                                                   |
| `Content#preview` column + Bazaar + `PAYMENT-REQUIRED` plumbing        | Low      | Deferred — most content is auto-registered via `verify-origin`; revisit once Worker is live                                                                                                           |
| ~~`ledewire-wallet` scheme discovery extension in `PAYMENT-REQUIRED`~~ | ✅ Done  | `WalletService#issue_payment_required` now populates extensions; `apiBase` is request-derived (env-aware); `signupUrl` configurable via `LEDEWIRE_SIGNUP_URL`                                         |
| ~~`payment-identifier` extension on Ledewire API~~                     | ✅ Done  | Implemented in `WalletService`; cache keyed `x402:pid:*`; TTL matches `accessToken`; no double-charge on network retry                                                                                |
| Wallet top-up via API                                                  | Medium   | Agents need funds before they can pay; currently top-up is browser-only (Stripe Checkout session). An `AgentWalletTopUp` endpoint or a pre-paid credit model is needed for fully headless deployments |
| Agent quickstart docs                                                  | **High** | "Here’s how to buy content from your agent in 5 lines of code" — all the above is moot without a clear integration guide                                                                              |

### Full agent flow (target state)

```
1. createLedewireFetch({ key: "bk_...", secret: "..." })
   └─ POST /v1/auth/login/buyer-api-key → buyer JWT

2. fetch("https://blog.example.com/posts/great-article")
   └─ Worker gate → 402 + PAYMENT-REQUIRED (ledewire-wallet)

3. @ledewire/x402-client reads PAYMENT-REQUIRED
   ├─ Reads extensions.ledewire-wallet.apiBase / authEndpoint
   └─ Constructs PAYMENT-SIGNATURE { token: buyer-JWT, contentId, nonce }
      └─ POST /v1/x402/contents/:id with PAYMENT-SIGNATURE
         └─ 200 PAYMENT-RESPONSE { accessToken: "<RS256 JWT>" }

4. @ledewire/x402-client retries original request with
   PAYMENT-SIGNATURE: base64({ payload: { accessToken } })
   └─ Worker verifies accessToken offline (resource_url === request.url)
      └─ 200 + content ↔ agent
```

The agent developer sees none of this. Their code is a single `fetch` call.

---

## Roadmap

```
Now                         Next                         Later
─────────────────────────────────────────────────────────────────►

┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ js-gate Phase 1  │    │ Cloudflare Worker│    │ CMS Plugins     │
│                  │    │                  │    │ (Ghost,         │
│ ContentPricing   │───►│ ~100 lines TS    │───►│  WordPress)     │
│ Rule             │    │ Distributed via  │    │                 │
│ StoreDomain      │    │ npm / CF Registry│    ├─────────────────┤
│ Verification     │    │                  │    │ Edge Middleware  │
│ Extended verify- │    ├──────────────────┤    │ (Vercel,        │
│ origin           │    │ Bazaar endpoint  │    │  Netlify)       │
│                  │    │ /v1/x402/        │    │                 │
│ (In progress)    │    │ discovery/       │    ├─────────────────┤
└──────────────────┘    │ resources        │    │ Browser         │
                        │                  │    │ Extension       │
                        │ (Low effort,     │    │ (Universal      │
                        │  high discovery  │    │  wallet)        │
                        │  value)          │    │                 │
                        └──────────────────┘    └─────────────────┘
```

**Recommended immediate next steps:**

1. ✅ ~~Complete Phase 1 of js-gate-design.md~~ — Worker prerequisites are all done
2. **Build the Cloudflare Worker** (`ledewire-gateway` repo, active focus) — see [cloudflare-worker-design.md](cloudflare-worker-design.md)
3. ✅ ~~**Build `UserApiKey` model + `POST /v1/auth/login/buyer-api-key`**~~ — implemented; see [buyer-api-key-design.md](buyer-api-key-design.md)
4. ✅ ~~Add `ledewire-wallet` scheme discovery extension to `PAYMENT-REQUIRED` in `WalletService`~~ — implemented; `apiBase` is request-derived, `signupUrl` via `LEDEWIRE_SIGNUP_URL`
5. Build `@ledewire/x402-client` TypeScript library (buyer auth + `ledewire-wallet` scheme handler)
6. ✅ ~~Add `payment-identifier` support to `WalletService`~~ — implemented; idempotent retry safety via Solid Cache
7. Add `GET /v1/x402/discovery/resources` (Bazaar)
8. Ship agent quickstart documentation
