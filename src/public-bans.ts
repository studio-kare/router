import { Database } from "bun:sqlite"

export interface BannedIpRecord {
  ipAddress: string
  reason: string
  bannedAt: number
  bannedBy: string
}

/**
 * BanManager: Manages IP banning for the public router
 * Maintains a blocklist in SQLite with fast in-memory lookup
 */
export class BanManager {
  private db: Database
  private bannedIps = new Set<string>()

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initTables()
    this.loadBans()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS banned_ips (
        ipAddress TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        bannedAt INTEGER NOT NULL,
        bannedBy TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_banned_ips_time
        ON banned_ips(bannedAt DESC);
    `)
  }

  private loadBans(): void {
    const rows = this.db.prepare(`
      SELECT ipAddress FROM banned_ips
    `).all() as Array<{ ipAddress: string }>

    this.bannedIps.clear()
    rows.forEach(row => {
      this.bannedIps.add(row.ipAddress)
    })
  }

  /**
   * Check if an IP is banned (fast in-memory lookup)
   */
  isBanned(ip: string): boolean {
    return this.bannedIps.has(ip)
  }

  /**
   * Ban an IP address
   */
  ban(ip: string, reason: string, bannedBy: string = "admin"): void {
    if (this.bannedIps.has(ip)) {
      // Update existing ban
      this.db.prepare(`
        UPDATE banned_ips
        SET reason = ?, bannedAt = ?, bannedBy = ?
        WHERE ipAddress = ?
      `).run(reason, Date.now(), bannedBy, ip)
    } else {
      // Insert new ban
      this.db.prepare(`
        INSERT INTO banned_ips (ipAddress, reason, bannedAt, bannedBy)
        VALUES (?, ?, ?, ?)
      `).run(ip, reason, Date.now(), bannedBy)

      this.bannedIps.add(ip)
    }
  }

  /**
   * Unban an IP address
   */
  unban(ip: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM banned_ips WHERE ipAddress = ?
    `).run(ip)

    if (result.changes > 0) {
      this.bannedIps.delete(ip)
      return true
    }
    return false
  }

  /**
   * Get all banned IPs
   */
  getBannedIps(limit: number = 100): BannedIpRecord[] {
    return this.db.prepare(`
      SELECT ipAddress, reason, bannedAt, bannedBy
      FROM banned_ips
      ORDER BY bannedAt DESC
      LIMIT ?
    `).all(limit) as BannedIpRecord[]
  }

  /**
   * Get ban record for a specific IP
   */
  getBanRecord(ip: string): BannedIpRecord | null {
    return this.db.prepare(`
      SELECT ipAddress, reason, bannedAt, bannedBy
      FROM banned_ips
      WHERE ipAddress = ?
    `).get(ip) as BannedIpRecord | undefined || null
  }

  /**
   * Get total number of banned IPs
   */
  getBanCount(): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM banned_ips
    `).get() as { count: number }

    return result.count
  }

  /**
   * Get bans created after a specific timestamp
   */
  getRecentBans(since: number, limit: number = 50): BannedIpRecord[] {
    return this.db.prepare(`
      SELECT ipAddress, reason, bannedAt, bannedBy
      FROM banned_ips
      WHERE bannedAt > ?
      ORDER BY bannedAt DESC
      LIMIT ?
    `).all(since, limit) as BannedIpRecord[]
  }
}

/**
 * Create a singleton instance of BanManager
 */
export function createBanManager(dbPath: string): BanManager {
  return new BanManager(dbPath)
}
