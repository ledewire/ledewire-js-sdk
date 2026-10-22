import { describe, it, expect, vi } from 'vitest'
import { createAgentClient, createClient } from './client.js'
import { createMockClient } from './testing.js'

/**
 * Helpers that the SDK calls internally but that are not part of the public
 * surface. Their `private` modifier is erased at runtime, so they are listed
 * here. Keep this list short: a public method belongs in createMockClient.
 */
const INTERNAL_HELPERS = new Set(['storeTokens', 'normalizeTokens'])

/** Fields that wire a namespace to its transport rather than expose an API. */
const TRANSPORT_FIELDS = new Set(['http', 'tokenManager', 'constructor'])

/**
 * Collects the dotted paths of every public method reachable from `obj`, for
 * example `publications.get` or `user.spendCap.update`. Walks prototype methods
 * (where namespace classes keep theirs) and nested namespace objects. Skips
 * `_`-prefixed fields, transport fields, and internal helpers.
 */
function publicMethods(obj: object, prefix = ''): string[] {
  const names = new Set<string>()
  let proto: object | null = obj
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) names.add(name)
    proto = Object.getPrototypeOf(proto) as object | null
  }

  const out: string[] = []
  for (const name of names) {
    if (name.startsWith('_') || TRANSPORT_FIELDS.has(name) || INTERNAL_HELPERS.has(name)) continue
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
  const mock = createMockClient(vi.fn)

  it('stubs every public method on createClient()', () => {
    const stubbed = new Set(publicMethods(mock))
    const missing = publicMethods(real).filter((path) => !stubbed.has(path))

    expect(missing).toEqual([])
  })

  it('stubs every public method on createAgentClient()', () => {
    const agent = createAgentClient({ key: 'k', secret: 's' })
    const stubbed = new Set(publicMethods(mock))
    const missing = publicMethods(agent).filter((path) => !stubbed.has(path))

    expect(missing).toEqual([])
  })

  it('finds a meaningful number of methods, so the walk is not silently empty', () => {
    expect(publicMethods(real).length).toBeGreaterThan(90)
  })
})
