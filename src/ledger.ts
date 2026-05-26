import { Context, Layer, Effect } from "effect"
import { Database } from "bun:sqlite"

export interface LedgerEntry {
  readonly id: string
  readonly keyId: string
  readonly timestamp: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly model: string
  readonly adapter: "anthropic" | "openai" | "openrouter"
  readonly costUsd: number
}

export class LedgerService extends Context.Service<
  LedgerService,
  {
    readonly recordUsage: (
      keyId: string,
      inputTokens: number,
      outputTokens: number,
      model: string,
      adapter: "anthropic" | "openai" | "openrouter",
      costUsd: number
    ) => Effect.Effect<LedgerEntry>
    readonly getKeyLedger: (keyId: string, limit?: number) => Effect.Effect<LedgerEntry[]>
  }
>()("LedgerService") {}

export const LedgerServiceLive = (() => {
  const db = new Database("./farmer.db")

  // Initialize table
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_ledger (
      id TEXT PRIMARY KEY,
      keyId TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      inputTokens INTEGER NOT NULL,
      outputTokens INTEGER NOT NULL,
      model TEXT NOT NULL,
      adapter TEXT NOT NULL,
      costUsd REAL NOT NULL,
      FOREIGN KEY (keyId) REFERENCES api_keys(id)
    )
  `)

  return Layer.succeed(LedgerService)({
    recordUsage: (keyId, inputTokens, outputTokens, model, adapter, costUsd) =>
      Effect.sync(() => {
        const id = crypto.randomUUID()
        const timestamp = Date.now()

        db.prepare(
          "INSERT INTO usage_ledger (id, keyId, timestamp, inputTokens, outputTokens, model, adapter, costUsd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(id, keyId, timestamp, inputTokens, outputTokens, model, adapter, costUsd)

        return { id, keyId, timestamp, inputTokens, outputTokens, model, adapter, costUsd }
      }),

    getKeyLedger: (keyId, limit = 100) =>
      Effect.sync(() => {
        const rows = db
          .prepare(
            "SELECT id, keyId, timestamp, inputTokens, outputTokens, model, adapter, costUsd FROM usage_ledger WHERE keyId = ? ORDER BY timestamp DESC LIMIT ?"
          )
          .all(keyId, limit) as LedgerEntry[]
        return rows.reverse() // Return in chronological order (oldest first)
      }),
  })
})()
