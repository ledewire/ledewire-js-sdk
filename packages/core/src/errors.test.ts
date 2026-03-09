import { describe, it, expect } from 'vitest'
import { LedewireError, AuthError, ForbiddenError, NotFoundError, PurchaseError } from './errors.js'

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
