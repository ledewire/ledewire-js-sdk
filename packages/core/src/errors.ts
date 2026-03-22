/**
 * Base error class for all LedeWire SDK errors.
 * All errors thrown by the SDK are instances of this class,
 * making it safe to use `err instanceof LedewireError` as a type guard.
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
  /** HTTP status code returned by the API (e.g. 400, 401, 404, 422). */
  public readonly statusCode: number

  /** Machine-readable error code from the API error body, if present. */
  public readonly code: number | undefined

  constructor(message: string, statusCode: number, code?: number) {
    super(message)
    this.name = 'LedewireError'
    this.statusCode = statusCode
    this.code = code
    // Restore prototype chain (required for extending built-in Error in TS)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the request lacks valid authentication credentials,
 * or when a token refresh fails and re-authentication is required.
 */
export class AuthError extends LedewireError {
  constructor(message: string, code?: number) {
    super(message, 401, code)
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
  constructor(message: string, code?: number) {
    super(message, 403, code)
    this.name = 'ForbiddenError'
  }
}

/**
 * Thrown when the requested resource does not exist.
 */
export class NotFoundError extends LedewireError {
  constructor(message: string, code?: number) {
    super(message, 404, code)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when the purchase cannot be completed due to a validation
 * failure, such as a price mismatch or a duplicate purchase.
 */
export class PurchaseError extends LedewireError {
  constructor(message: string, statusCode: number, code?: number) {
    super(message, statusCode, code)
    this.name = 'PurchaseError'
  }
}
