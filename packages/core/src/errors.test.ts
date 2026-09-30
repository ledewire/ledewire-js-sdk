import { describe, it, expect, vi } from 'vitest'
import {
  LedewireError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  PurchaseError,
  SpendCapReachedError,
} from './errors.js'

describe('LedewireError', () => {
  it('has correct name and properties', () => {
    const err = new LedewireError('Something went wrong', 422, 1001)
    expect(err.name).toBe('LedewireError')
    expect(err.message).toBe('Something went wrong')
    expect(err.statusCode).toBe(422)
    expect(err.code).toBe(1001)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(LedewireError)
  })

  it('works without an error code', () => {
    const err = new LedewireError('Not found', 404)
    expect(err.code).toBeUndefined()
  })

  it('carries an optional machine-readable error type', () => {
    const withType = new LedewireError('Insufficient funds', 402, 2002, 'insufficient_funds')
    expect(withType.type).toBe('insufficient_funds')

    const withoutType = new LedewireError('Something went wrong', 500)
    expect(withoutType.type).toBeUndefined()
  })
})

describe('AuthError', () => {
  it('is instanceof LedewireError with statusCode 401', () => {
    const err = new AuthError('Unauthorized')
    expect(err.name).toBe('AuthError')
    expect(err.statusCode).toBe(401)
    expect(err).toBeInstanceOf(LedewireError)
    expect(err).toBeInstanceOf(AuthError)
  })
})

describe('ForbiddenError', () => {
  it('has statusCode 403', () => {
    const err = new ForbiddenError('Forbidden')
    expect(err.statusCode).toBe(403)
    expect(err).toBeInstanceOf(LedewireError)
  })
})

describe('NotFoundError', () => {
  it('has statusCode 404', () => {
    const err = new NotFoundError('Not found')
    expect(err.statusCode).toBe(404)
    expect(err).toBeInstanceOf(LedewireError)
  })
})

describe('PurchaseError', () => {
  it('is instanceof LedewireError with configurable statusCode', () => {
    const err = new PurchaseError('Price mismatch', 409, 2001)
    expect(err.name).toBe('PurchaseError')
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe(2001)
    expect(err).toBeInstanceOf(LedewireError)
  })
})

describe('SpendCapReachedError', () => {
  it('has statusCode 402, type daily_spend_cap_reached, and the cap fields', () => {
    const err = new SpendCapReachedError('Daily spend cap reached', {
      capCents: 5000,
      spentCents: 5000,
      remainingCents: 0,
      resetsAt: '2099-01-02T00:00:00Z',
      bulkExempt: false,
    })
    expect(err.name).toBe('SpendCapReachedError')
    expect(err.statusCode).toBe(402)
    expect(err.type).toBe('daily_spend_cap_reached')
    expect(err.capCents).toBe(5000)
    expect(err.spentCents).toBe(5000)
    expect(err.remainingCents).toBe(0)
    expect(err.resetsAt).toBe('2099-01-02T00:00:00Z')
    expect(err.bulkExempt).toBe(false)
    expect(err).toBeInstanceOf(LedewireError)
    expect(err).toBeInstanceOf(SpendCapReachedError)
  })

  it('accepts an optional machine-readable code', () => {
    const err = new SpendCapReachedError(
      'Daily spend cap reached',
      {
        capCents: 1000,
        spentCents: 1000,
        remainingCents: 0,
        resetsAt: '2099-01-02T00:00:00Z',
        bulkExempt: true,
      },
      4020,
    )
    expect(err.code).toBe(4020)
    expect(err.bulkExempt).toBe(true)
  })
})

describe('instanceof checks across the hierarchy', () => {
  it('all subclasses satisfy instanceof LedewireError', () => {
    const errors = [
      new AuthError('a'),
      new ForbiddenError('b'),
      new NotFoundError('c'),
      new PurchaseError('d', 400),
    ]
    for (const err of errors) {
      expect(err).toBeInstanceOf(LedewireError)
      expect(err).toBeInstanceOf(Error)
    }
  })
})

describe('cross-bundle instanceof', () => {
  // @ledewire/core is bundled separately into every published package, so in
  // production a `SpendCapReachedError` thrown by @ledewire/x402-client and
  // the `SpendCapReachedError` class imported from @ledewire/node are
  // distinct class objects with unrelated prototypes. Simulate that by
  // resetting the module registry and re-importing errors.ts, which gives us
  // a second, genuinely different copy of every class in this file.
  async function loadSecondCopy() {
    vi.resetModules()
    return import('./errors.js')
  }

  it('is a genuinely different class object (sanity check on the simulation)', async () => {
    const otherCopy = await loadSecondCopy()
    expect(otherCopy.SpendCapReachedError).not.toBe(SpendCapReachedError)
  })

  it('an error built by a second bundle copy is instanceof the original class', async () => {
    const otherCopy = await loadSecondCopy()
    const err = new otherCopy.SpendCapReachedError('Daily spend cap reached', {
      capCents: 5000,
      spentCents: 5000,
      remainingCents: 0,
      resetsAt: '2099-01-02T00:00:00Z',
      bulkExempt: false,
    })

    expect(err).toBeInstanceOf(SpendCapReachedError)
    expect(err).toBeInstanceOf(LedewireError)
  })

  it('an error built by the original class is instanceof the class from a second bundle copy', async () => {
    const otherCopy = await loadSecondCopy()
    const err = new SpendCapReachedError('Daily spend cap reached', {
      capCents: 100,
      spentCents: 100,
      remainingCents: 0,
      resetsAt: '2099-01-01T00:00:00Z',
      bulkExempt: false,
    })

    expect(err).toBeInstanceOf(otherCopy.SpendCapReachedError)
    expect(err).toBeInstanceOf(otherCopy.LedewireError)
  })

  it('AuthError is NOT instanceof SpendCapReachedError, in either bundle-copy direction', async () => {
    const otherCopy = await loadSecondCopy()

    const authFromOtherCopy = new otherCopy.AuthError('nope')
    expect(authFromOtherCopy).not.toBeInstanceOf(SpendCapReachedError)
    expect(authFromOtherCopy).toBeInstanceOf(LedewireError)

    const authFromOriginal = new AuthError('nope')
    expect(authFromOriginal).not.toBeInstanceOf(otherCopy.SpendCapReachedError)
    expect(authFromOriginal).toBeInstanceOf(otherCopy.LedewireError)
  })
})

describe('LedewireError[Symbol.hasInstance] against non-error values', () => {
  it('is false for primitives, null, and undefined', () => {
    expect(5).not.toBeInstanceOf(SpendCapReachedError)
    expect('x').not.toBeInstanceOf(SpendCapReachedError)
    expect(null).not.toBeInstanceOf(SpendCapReachedError)
    expect(undefined).not.toBeInstanceOf(SpendCapReachedError)
  })
})

describe('LedewireError.details', () => {
  it('is undefined when no details are supplied', () => {
    const err = new LedewireError('Not found', 404)
    expect(err.details).toBeUndefined()
  })

  it('carries the extra top-level error-body fields when supplied', () => {
    const err = new LedewireError('Selection too large', 422, undefined, 'selection_too_large', {
      maximum: 100,
      submitted: 142,
    })
    expect(err.details).toEqual({ maximum: 100, submitted: 142 })
  })
})

describe('LedewireError.type accepts values beyond the documented ErrorType enum', () => {
  it('keeps an open-ended error.type string verbatim', () => {
    const err = new LedewireError('Selection too large', 422, undefined, 'selection_too_large')
    expect(err.type).toBe('selection_too_large')
  })
})
