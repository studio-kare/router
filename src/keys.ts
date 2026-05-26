import { Context, Layer, Effect } from "effect"
import { Database } from "bun:sqlite"

export interface ApiKey {
  readonly id: string
  readonly key: string
  readonly createdAt: number
  readonly lastUsed: number | null
  readonly revokedAt: number | null
}

export class KeyService extends Context.Service<
  KeyService,
  {
    readonly generateKey: () => Effect.Effect<ApiKey>
    readonly validateKey: (key: string) => Effect.Effect<ApiKey | null>
    readonly listKeys: () => Effect.Effect<ApiKey[]>
    readonly revokeKey: (key: string) => Effect.Effect<void>
    readonly recordUsage: (key: string) => Effect.Effect<void>
    readonly clearAllKeys: () => Effect.Effect<void>
  }
>()("KeyService") {}

export const KeyServiceLive = (() => {
  const db = new Database("./farmer.db")

  // Initialize table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      createdAt INTEGER NOT NULL,
      lastUsed INTEGER,
      revokedAt INTEGER
    )
  `)

  const generateRandomKey = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let key = "sk_"
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return key
  }

  return Layer.succeed(KeyService)({
    generateKey: () =>
      Effect.sync(() => {
        const id = crypto.randomUUID()
        const key = generateRandomKey()
        const now = Date.now()

        db.prepare(
          "INSERT INTO api_keys (id, key, createdAt, lastUsed, revokedAt) VALUES (?, ?, ?, ?, ?)"
        ).run(id, key, now, null, null)

        return { id, key, createdAt: now, lastUsed: null, revokedAt: null }
      }),

    validateKey: (key: string) =>
      Effect.sync(() => {
        const row = db
          .prepare("SELECT * FROM api_keys WHERE key = ? AND revokedAt IS NULL")
          .get(key) as {
          id: string
          key: string
          createdAt: number
          lastUsed: number | null
          revokedAt: number | null
        } | undefined

        return row || null
      }),

    listKeys: () =>
      Effect.sync(() => {
        const rows = db
          .prepare("SELECT id, key, createdAt, lastUsed, revokedAt FROM api_keys ORDER BY createdAt DESC")
          .all() as ApiKey[]
        return rows
      }),

    revokeKey: (key: string) =>
      Effect.sync(() => {
        db.prepare("UPDATE api_keys SET revokedAt = ? WHERE key = ?").run(Date.now(), key)
      }),

    recordUsage: (key: string) =>
      Effect.sync(() => {
        db.prepare("UPDATE api_keys SET lastUsed = ? WHERE key = ?").run(Date.now(), key)
      }),

    clearAllKeys: () =>
      Effect.sync(() => {
        db.prepare("UPDATE api_keys SET revokedAt = ? WHERE revokedAt IS NULL").run(Date.now())
      }),
  })
})()
