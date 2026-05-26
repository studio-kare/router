import { test, expect } from "bun:test"
import { Effect, Layer, ManagedRuntime } from "effect"
import { KeyService, KeyServiceLive } from "./keys"

test("KeyService: generate key", async () => {
  const runtime = ManagedRuntime.make(KeyServiceLive)
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const keyService = yield* KeyService
      const key = yield* keyService.generateKey()
      return key
    })
  )

  expect(result.key).toMatch(/^sk_[A-Za-z0-9]{32}$/)
  expect(result.id).toBeDefined()
  expect(result.createdAt).toBeGreaterThan(0)
  expect(result.lastUsed).toBeNull()
  expect(result.revokedAt).toBeNull()
})

test("KeyService: validate key", async () => {
  const runtime = ManagedRuntime.make(KeyServiceLive)

  const generateAndValidate = Effect.gen(function* () {
    const keyService = yield* KeyService

    // Generate a key
    const generated = yield* keyService.generateKey()
    const generatedKey = generated.key

    // Validate the same key
    const validated = yield* keyService.validateKey(generatedKey)

    return { generatedKey, validated }
  })

  const { generatedKey, validated } = await runtime.runPromise(generateAndValidate)

  expect(validated).not.toBeNull()
  expect(validated?.key).toBe(generatedKey)
})

test("KeyService: reject invalid key", async () => {
  const runtime = ManagedRuntime.make(KeyServiceLive)

  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const keyService = yield* KeyService
      return yield* keyService.validateKey("sk_invalid_key")
    })
  )

  expect(result).toBeNull()
})

test("KeyService: list keys", async () => {
  const runtime = ManagedRuntime.make(KeyServiceLive)

  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const keyService = yield* KeyService

      // Get initial count
      const initialKeys = yield* keyService.listKeys()
      const initialCount = initialKeys.length

      // Generate two keys
      yield* keyService.generateKey()
      yield* keyService.generateKey()

      // List keys
      const finalKeys = yield* keyService.listKeys()
      return { initialCount, finalCount: finalKeys.length, finalKeys }
    })
  )

  expect(result.finalCount).toBe(result.initialCount + 2)
  expect(result.finalKeys[0].key).toMatch(/^sk_/)
})

test("KeyService: revoke key", async () => {
  const runtime = ManagedRuntime.make(KeyServiceLive)

  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const keyService = yield* KeyService

      // Generate a key
      const { key } = yield* keyService.generateKey()

      // Revoke it
      yield* keyService.revokeKey(key)

      // Try to validate revoked key
      const validated = yield* keyService.validateKey(key)

      return validated
    })
  )

  expect(result).toBeNull()
})

test("KeyService: record usage", async () => {
  const runtime = ManagedRuntime.make(KeyServiceLive)

  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const keyService = yield* KeyService

      // Generate a key
      const { key } = yield* keyService.generateKey()

      // Verify lastUsed is null before recording
      const beforeKeys = yield* keyService.listKeys()
      const keyBefore = beforeKeys.find((k) => k.key === key)

      // Record usage
      yield* keyService.recordUsage(key)

      // Get the key and check lastUsed
      const afterKeys = yield* keyService.listKeys()
      const keyAfter = afterKeys.find((k) => k.key === key)

      return { before: keyBefore?.lastUsed, after: keyAfter?.lastUsed }
    })
  )

  expect(result.before).toBeNull()
  expect(result.after).toBeGreaterThan(0)
})
