import type { ErrorType } from './types.js'

/**
 * Known {@link ErrorType} values, widened to accept any other string the API
 * may introduce. `ErrorType` still drives editor autocomplete; a value the API
 * emits that isn't (yet) in the spec's enum — e.g. `selection_too_large` on
 * `POST /v1/acquisitions` — still type-checks and survives on {@link
 * LedewireError.type} instead of being narrowed away.
 */
export type ErrorTypeValue = ErrorType | (string & {})

/**
 * Global-symbol-registry key for the non-enumerable class-brand list every
 * `LedewireError` instance carries. See {@link LedewireError[Symbol.hasInstance]}.
 *
 * `@ledewire/core` is private and bundled separately into every published
 * package (via tsup), so `SpendCapReachedError` — and every other class in
 * this file — exists as a *distinct* class object in `@ledewire/node`,
 * `@ledewire/browser`, and `@ledewire/x402-client`. `Symbol.for` (the global
 * symbol registry, keyed by string and shared process-wide) rather than
 * `Symbol()` means every one of those bundle copies resolves this constant to
 * the *same* symbol, so a brand list written by one copy's constructor is
 * still readable by another copy's `hasInstance` check.
 */
const ERROR_BRAND = Symbol.for('@ledewire/error-brands')

/**
 * Base error class for all LedeWire SDK errors.
 * All errors thrown by the SDK are instances of this class,
 * making it safe to use `err instanceof LedewireError` as a type guard.
 *
 * `instanceof` works even when `err` was constructed by a different bundled
 * copy of this class — e.g. an error thrown by `@ledewire/x402-client`
 * checked with the `SpendCapReachedError` bundled into `@ledewire/node`. See
 * {@link LedewireError[Symbol.hasInstance]}.
 *
 * @example
 * ```ts
 * try {
 *   await client.purchases.create({ contentId: '...' })
 * } catch (err) {
 *   if (err instanceof LedewireError) {
 *     console.error(err.statusCode, err.message)
 *   }
 * }
 * ```
 */
export class LedewireError extends Error {
  /**
   * Class-identity brand used for cross-bundle `instanceof` (see {@link
   * LedewireError[Symbol.hasInstance]}). Hardcoded per class — never derived
   * from `constructor.name` or `this.name`, either of which a minifier can
   * rewrite, silently breaking the brand match.
   */
  static readonly brand: string = 'LedewireError'

  /** HTTP status code returned by the API (e.g. 400, 401, 404, 422). */
  public readonly statusCode: number

  /** Machine-readable error code from the API error body, if present. */
  public readonly code: number | undefined

  /**
   * Machine-readable reason from the API error body's `error.type`, if present.
   * See {@link ErrorType} for the documented values and how to branch on them —
   * the API may emit other values it hasn't documented yet, which still land
   * here as a plain string rather than being dropped.
   */
  public readonly type: ErrorTypeValue | undefined

  /**
   * Extra top-level fields from the API error response body, excluding
   * `error` itself. For example, a `selection_too_large` refusal from `POST
   * /v1/acquisitions` (422) carries `maximum` and `submitted` alongside
   * `error`. `undefined` when the body carried no other top-level fields,
   * which is the common case.
   */
  public readonly details: Readonly<Record<string, unknown>> | undefined

  constructor(
    message: string,
    statusCode: number,
    code?: number,
    type?: ErrorTypeValue,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'LedewireError'
    this.statusCode = statusCode
    this.code = code
    this.type = type
    this.details = details
    // Restore prototype chain (required for extending built-in Error in TS)
    Object.setPrototypeOf(this, new.target.prototype)

    // Collect this instance's class brands by walking new.target's own
    // prototype (constructor) chain, so hasInstance can fall back to a
    // brand check when the normal prototype check fails across bundles.
    const brands: string[] = []
    let ctor: unknown = new.target
    while (typeof ctor === 'function') {
      const ownBrand = (ctor as { brand?: unknown }).brand
      if (typeof ownBrand === 'string' && Object.prototype.hasOwnProperty.call(ctor, 'brand')) {
        brands.push(ownBrand)
      }
      ctor = Object.getPrototypeOf(ctor)
    }
    Object.defineProperty(this, ERROR_BRAND, {
      value: brands,
      enumerable: false,
      configurable: true,
    })
  }

  /**
   * Makes `err instanceof LedewireError` (and every subclass below) true even
   * when `err` was constructed by a *different* bundled copy of this module.
   * Each published package (`@ledewire/node`, `@ledewire/browser`,
   * `@ledewire/x402-client`) bundles its own copy of `@ledewire/core` via
   * tsup, so the classes are distinct objects with unrelated prototypes —
   * the plain prototype-chain check `instanceof` normally does would fail.
   *
   * Falls back to the brand list every instance carries under a
   * `Symbol.for('@ledewire/error-brands')` key (collected from the `brand`
   * static along the constructing class's prototype chain): true when the
   * ordinary check passes, OR the instance's brand list includes this
   * class's own `brand`.
   */
  static override [Symbol.hasInstance](instance: unknown): boolean {
    if (Function.prototype[Symbol.hasInstance].call(this, instance)) {
      return true
    }
    if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) {
      return false
    }
    const brands = (instance as Record<PropertyKey, unknown>)[ERROR_BRAND]
    return Array.isArray(brands) && brands.includes(this.brand)
  }
}

/**
 * Thrown when the request lacks valid authentication credentials,
 * or when a token refresh fails and re-authentication is required.
 */
export class AuthError extends LedewireError {
  static override readonly brand: string = 'AuthError'

  constructor(
    message: string,
    code?: number,
    type?: ErrorTypeValue,
    details?: Record<string, unknown>,
  ) {
    super(message, 401, code, type, details)
    this.name = 'AuthError'
  }
}

/**
 * Thrown when the authenticated user does not have permission
 * to perform the requested operation.
 *
 * **Common cause — merchant login with the wrong account role:**
 * `POST /v1/auth/merchant/login/email` and `POST /v1/auth/merchant/login/google`
 * return `403 Forbidden` (not `401`) when the credentials are valid but the
 * account has no merchant store associations (e.g. a buyer account used on the
 * merchant endpoint). The `err.message` will be:
 * `"This account does not have merchant access. Use a merchant or owner account."`
 *
 * Use a different account or ask a store owner to add your account as a member.
 *
 * @example
 * ```ts
 * // Browser
 * import { ForbiddenError, AuthError } from '@ledewire/browser'
 *
 * try {
 *   await lw.auth.loginWithGoogle({ id_token })
 * } catch (err) {
 *   if (err instanceof ForbiddenError) {
 *     // Credentials were valid but account lacks the required role.
 *     console.error('Access denied:', err.message)
 *   } else if (err instanceof AuthError) {
 *     // Bad credentials or expired token — re-authenticate.
 *     console.error('Authentication failed:', err.message)
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Node
 * import { ForbiddenError, AuthError } from '@ledewire/node'
 *
 * try {
 *   await client.merchant.auth.loginWithGoogle({ id_token })
 * } catch (err) {
 *   if (err instanceof ForbiddenError) {
 *     // Credentials were valid but account has no merchant store access.
 *     // err.message → "This account does not have merchant access. Use a merchant or owner account."
 *     console.error('Wrong account role:', err.message)
 *   } else if (err instanceof AuthError) {
 *     // Bad credentials or expired token — re-authenticate.
 *     console.error('Authentication failed:', err.message)
 *   }
 * }
 * ```
 */
export class ForbiddenError extends LedewireError {
  static override readonly brand: string = 'ForbiddenError'

  constructor(
    message: string,
    code?: number,
    type?: ErrorTypeValue,
    details?: Record<string, unknown>,
  ) {
    super(message, 403, code, type, details)
    this.name = 'ForbiddenError'
  }
}

/**
 * Thrown when the requested resource does not exist.
 */
export class NotFoundError extends LedewireError {
  static override readonly brand: string = 'NotFoundError'

  constructor(
    message: string,
    code?: number,
    type?: ErrorTypeValue,
    details?: Record<string, unknown>,
  ) {
    super(message, 404, code, type, details)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when the purchase cannot be completed due to a validation
 * failure, such as a price mismatch or a duplicate purchase.
 */
export class PurchaseError extends LedewireError {
  static override readonly brand: string = 'PurchaseError'

  constructor(
    message: string,
    statusCode: number,
    code?: number,
    type?: ErrorTypeValue,
    details?: Record<string, unknown>,
  ) {
    super(message, statusCode, code, type, details)
    this.name = 'PurchaseError'
  }
}

/**
 * Thrown when the buyer's daily spend cap has been reached. Returned as HTTP `402`
 * by `POST /v1/purchases`, `GET /v1/x402/contents/{id}`, and acquisition
 * authorization, whenever the API error body's `error.type` is
 * `'daily_spend_cap_reached'`.
 *
 * **Funding the wallet does not clear this.** Unlike a plain `insufficient_funds`
 * 402 — where adding money to the wallet is enough to retry — a spend cap refusal
 * is a daily policy limit on the buyer's account (every new buyer starts with a
 * default cap). It clears only when the spend window rolls over at {@link
 * SpendCapReachedError.resetsAt}, or when the buyer raises or removes the cap via
 * `user.spendCap.update()`.
 *
 * @example
 * ```ts
 * try {
 *   await client.purchases.create({ content_id })
 * } catch (err) {
 *   if (err instanceof SpendCapReachedError) {
 *     // Do NOT prompt the buyer to fund their wallet — that won't help.
 *     console.error(
 *       `Spend cap reached: spent ${err.spentCents} of ${err.capCents} cents. ` +
 *         `Resets at ${err.resetsAt}.`,
 *     )
 *   }
 * }
 * ```
 */
export class SpendCapReachedError extends LedewireError {
  static override readonly brand: string = 'SpendCapReachedError'

  /** The buyer's daily spend cap in cents. */
  public readonly capCents: number

  /** Total spent so far in the current spend window. */
  public readonly spentCents: number

  /** Cap minus spend so far, floored at zero — what the buyer may still spend in this window. */
  public readonly remainingCents: number

  /** ISO 8601 timestamp (UTC) of the instant the current spend window rolls. */
  public readonly resetsAt: string

  /**
   * Whether this buyer's bulk acquisitions are exempt from the cap. When `true`,
   * `spentCents` and `remainingCents` describe ordinary spend only — an authorized
   * bulk acquisition does not consume them.
   */
  public readonly bulkExempt: boolean

  constructor(
    message: string,
    capInfo: {
      capCents: number
      spentCents: number
      remainingCents: number
      resetsAt: string
      bulkExempt: boolean
    },
    code?: number,
  ) {
    super(message, 402, code, 'daily_spend_cap_reached')
    this.name = 'SpendCapReachedError'
    this.capCents = capInfo.capCents
    this.spentCents = capInfo.spentCents
    this.remainingCents = capInfo.remainingCents
    this.resetsAt = capInfo.resetsAt
    this.bulkExempt = capInfo.bulkExempt
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
