import { describe, it, expect, vi } from 'vitest'
import { createAgentClient, createClient } from './client.js'
import { createMockClient } from './testing.js'

/**
 * Private helpers that the SDK calls internally. Their `private` modifier is
 * erased at runtime, so they are listed here. Each entry is `Class.method`, so a
 * public method with the same name on another class is still checked. Keep this
 * list short: a public method belongs in createMockClient.
 */
const INTERNAL_HELPERS = new Set([
  'AuthNamespace.storeTokens',
  'MerchantAuthNamespace.storeTokens',
  'MerchantAuthNamespace.normalizeTokens',
])

/** Fields that wire a namespace to its transport rather than expose an API. */
const TRANSPORT_FIELDS = new Set(['http', 'tokenManager', 'constructor'])

/**
 * Collects the dotted paths of every public method reachable from `obj`, for
 * example `publications.get` or `user.spendCap.update`. Walks prototype methods
 * (where namespace classes keep theirs) and nested namespace objects. Skips
 * `_`-prefixed fields, transport fields, and internal helpers.
 */
function publicMethods(obj: object, prefix = ''): string[] {
  const owners = new Map<string, string>()
  let proto: object | null = obj
  while (proto && proto !== Object.prototype) {
    const owner = (proto as { constructor?: { name?: string } }).constructor?.name ?? ''
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (!owners.has(name)) owners.set(name, owner)
    }
    proto = Object.getPrototypeOf(proto) as object | null
  }

  const out: string[] = []
  for (const [name, owner] of owners) {
    if (name.startsWith('_') || TRANSPORT_FIELDS.has(name)) continue
    if (INTERNAL_HELPERS.has(`${owner}.${name}`)) continue
    const value = (obj as Record<string, unknown>)[name]
    if (typeof value === 'function') {
      if (!/^[A-Z]/.test(name)) out.push(prefix + name)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...publicMethods(value, prefix + name + '.'))
    }
  }
  return out.sort()
}

describe('createMockClient parity', () => {
  const real = createClient({ apiKey: 'k', apiSecret: 's' })
  const agent = createAgentClient({ key: 'k', secret: 's' })
  const mock = createMockClient(vi.fn)
  const stubbed = new Set(publicMethods(mock))

  it('stubs every public method on createClient()', () => {
    const missing = publicMethods(real).filter((path) => !stubbed.has(path))

    expect(missing).toEqual([])
  })

  it('stubs every public method on createAgentClient()', () => {
    const missing = publicMethods(agent).filter((path) => !stubbed.has(path))

    expect(missing).toEqual([])
  })

  it('has no stub for a method that neither client exposes', () => {
    const exposed = new Set([...publicMethods(real), ...publicMethods(agent)])
    const stale = [...stubbed].filter((path) => !exposed.has(path))

    expect(stale).toEqual([])
  })

  it('finds a meaningful number of methods, so the walk is not silently empty', () => {
    expect(publicMethods(real).length).toBeGreaterThan(90)
  })
})
