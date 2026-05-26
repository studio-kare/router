import { Context, Layer, Effect } from "effect"
import { KeyService } from "./keys"

// Test layer that accepts any key starting with "sk_test_"
export const KeyServiceTest = Layer.succeed(KeyService)({
  generateKey: () =>
    Effect.sync(() => ({
      id: crypto.randomUUID(),
      key: `sk_test_${Math.random().toString(36).slice(2, 34)}`,
      createdAt: Date.now(),
      lastUsed: null,
      revokedAt: null,
    })),

  validateKey: (key: string) =>
    Effect.sync(() => {
      // In tests, accept any key starting with "sk_"
      if (key.startsWith("sk_")) {
        return {
          id: crypto.randomUUID(),
          key,
          createdAt: Date.now(),
          lastUsed: null,
          revokedAt: null,
        }
      }
      return null
    }),

  listKeys: () =>
    Effect.sync(() => []),

  revokeKey: (_key: string) =>
    Effect.sync(() => {}),

  recordUsage: (_key: string) =>
    Effect.sync(() => {}),
})
