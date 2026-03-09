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
