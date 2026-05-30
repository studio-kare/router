import { Database } from "bun:sqlite"

export interface PublicUsageRecord {
  id: string
  ipAddress: string
  timestamp: number
  inputTokens: number
  outputTokens: number
  model: string
  costUsd: number
}

export interface IpUsageStats {
  ipAddress: string
  requestCount: number
  totalTokens: number
  totalCost: number
}

/**
 * PublicMetrics: Tracks per-IP usage for the public router
 * Stores usage history in SQLite and provides aggregation queries
 */
export class PublicMetrics {
  private db: Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initTables()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS public_usage (
        id TEXT PRIMARY KEY,
        ipAddress TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        inputTokens INTEGER NOT NULL,
        outputTokens INTEGER NOT NULL,
        model TEXT NOT NULL,
        costUsd REAL NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_public_usage_ip_time
        ON public_usage(ipAddress, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_public_usage_timestamp
        ON public_usage(timestamp DESC);
    `)
  }

  /**
   * Record a single API usage event
   */
  recordUsage(data: {
    ip: string
    inputTokens: number
    outputTokens: number
    model: string
    costUsd: number
  }): void {
    const id = crypto.randomUUID()
    const timestamp = Date.now()

    this.db.prepare(`
      INSERT INTO public_usage
        (id, ipAddress, timestamp, inputTokens, outputTokens, model, costUsd)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.ip, timestamp, data.inputTokens, data.outputTokens, data.model, data.costUsd)
  }

  /**
   * Get top IPs by token usage in the last N hours (default 24)
   */
  getTopIpsByUsage(limit: number = 20, hoursBack: number = 24): IpUsageStats[] {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000

    return this.db.prepare(`
      SELECT
        ipAddress,
        COUNT(*) as requestCount,
        SUM(inputTokens) + SUM(outputTokens) as totalTokens,
        SUM(costUsd) as totalCost
      FROM public_usage
      WHERE timestamp > ?
      GROUP BY ipAddress
      ORDER BY totalTokens DESC
      LIMIT ?
    `).all(cutoffTime, limit) as IpUsageStats[]
  }

  /**
   * Get usage stats for a specific IP in the last 24 hours
   */
  getIpStats(ip: string, hoursBack: number = 24): IpUsageStats | null {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000

    const result = this.db.prepare(`
      SELECT
        ipAddress,
        COUNT(*) as requestCount,
        SUM(inputTokens) + SUM(outputTokens) as totalTokens,
        SUM(costUsd) as totalCost
      FROM public_usage
      WHERE ipAddress = ? AND timestamp > ?
      GROUP BY ipAddress
    `).get(ip, cutoffTime) as IpUsageStats | undefined

    return result || null
  }

  /**
   * Get total usage stats across all IPs (last 24 hours)
   */
  getTotalUsageStats(hoursBack: number = 24): {
    totalRequests: number
    totalTokens: number
    totalCost: number
    uniqueIps: number
  } {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000

    const result = this.db.prepare(`
      SELECT
        COUNT(*) as totalRequests,
        SUM(inputTokens) + SUM(outputTokens) as totalTokens,
        SUM(costUsd) as totalCost,
        COUNT(DISTINCT ipAddress) as uniqueIps
      FROM public_usage
      WHERE timestamp > ?
    `).get(cutoffTime) as {
      totalRequests: number
      totalTokens: number
      totalCost: number
      uniqueIps: number
    }

    return result
  }

  /**
   * Get usage trend over the last N days (hourly buckets)
   */
  getDailyUsageTrend(days: number = 7): Array<{
    date: string
    requests: number
    tokens: number
    cost: number
  }> {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

    return this.db.prepare(`
      SELECT
        DATE(timestamp / 1000, 'unixepoch') as date,
        COUNT(*) as requests,
        SUM(inputTokens) + SUM(outputTokens) as tokens,
        SUM(costUsd) as cost
      FROM public_usage
      WHERE timestamp > ?
      GROUP BY date
      ORDER BY date DESC
    `).all(cutoffTime) as Array<{
      date: string
      requests: number
      tokens: number
      cost: number
    }>
  }

  /**
   * Get popular models in the last 24 hours
   */
  getPopularModels(limit: number = 10, hoursBack: number = 24): Array<{
    model: string
    requestCount: number
    totalTokens: number
  }> {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000

    return this.db.prepare(`
      SELECT
        model,
        COUNT(*) as requestCount,
        SUM(inputTokens) + SUM(outputTokens) as totalTokens
      FROM public_usage
      WHERE timestamp > ?
      GROUP BY model
      ORDER BY requestCount DESC
      LIMIT ?
    `).all(cutoffTime, limit) as Array<{
      model: string
      requestCount: number
      totalTokens: number
    }>
  }

  /**
   * Clean up old records (older than N days)
   */
  cleanup(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

    const result = this.db.prepare(`
      DELETE FROM public_usage
      WHERE timestamp < ?
    `).run(cutoffTime)

    return result.changes
  }

  /**
   * Get all records (for debugging/export)
   */
  getAllRecords(limit: number = 1000): PublicUsageRecord[] {
    return this.db.prepare(`
      SELECT * FROM public_usage
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as PublicUsageRecord[]
  }
}

/**
 * Create a singleton instance of PublicMetrics
 */
export function createPublicMetrics(dbPath: string): PublicMetrics {
  return new PublicMetrics(dbPath)
}
