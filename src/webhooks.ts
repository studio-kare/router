import { Database } from "bun:sqlite"

export interface WatchedRepo {
  repo_full_name: string
  webhook_id: number
  created_at: number
}

export interface WebhookEvent {
  id: string
  repo: string
  event_type: string
  action: string
  issue_number: number
  issue_title: string
  comment_body: string | null
  author: string
  url: string
  created_at: number
}

export class WebhookService {
  private db: Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initTables()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watched_repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_full_name TEXT NOT NULL UNIQUE,
        webhook_id INTEGER NOT NULL,
        webhook_secret TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        delivery_id TEXT UNIQUE,
        repo TEXT NOT NULL,
        event_type TEXT NOT NULL,
        action TEXT NOT NULL,
        issue_number INTEGER NOT NULL,
        issue_title TEXT NOT NULL,
        comment_body TEXT,
        author TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_events_repo_time
        ON webhook_events(repo, created_at DESC);
    `)
  }

  async setupWebhook(
    repoFullName: string,
    accessToken: string,
    callbackUrl: string,
    createdBy: number
  ): Promise<{ ok: true } | { error: string }> {
    // Check if already watched
    const existing = this.db.prepare(
      "SELECT webhook_id FROM watched_repos WHERE repo_full_name = ?"
    ).get(repoFullName)
    if (existing) return { ok: true }

    // Check for existing webhook at this URL
    const listRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/hooks`,
      { headers: githubHeaders(accessToken) }
    )
    if (!listRes.ok) {
      return { error: `GitHub API error: ${listRes.status} ${await listRes.text()}` }
    }

    const hooks = (await listRes.json()) as Array<{ id: number; config: { url: string } }>
    const existingHook = hooks.find((h) => h.config.url === callbackUrl)
    if (existingHook) {
      // Already set up on GitHub, just store locally
      const secret = crypto.randomUUID()
      this.db.prepare(`
        INSERT INTO watched_repos (repo_full_name, webhook_id, webhook_secret, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(repoFullName, existingHook.id, secret, createdBy, Date.now())
      // Need to update the secret on GitHub too
      await fetch(`https://api.github.com/repos/${repoFullName}/hooks/${existingHook.id}`, {
        method: "PATCH",
        headers: githubHeaders(accessToken),
        body: JSON.stringify({ config: { url: callbackUrl, content_type: "json", secret } }),
      })
      return { ok: true }
    }

    // Create new webhook
    const secret = crypto.randomUUID()
    const createRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/hooks`,
      {
        method: "POST",
        headers: githubHeaders(accessToken),
        body: JSON.stringify({
          config: { url: callbackUrl, content_type: "json", secret },
          events: ["issues", "issue_comment"],
          active: true,
        }),
      }
    )

    if (!createRes.ok) {
      return { error: `Failed to create webhook: ${createRes.status} ${await createRes.text()}` }
    }

    const hook = (await createRes.json()) as { id: number }

    this.db.prepare(`
      INSERT INTO watched_repos (repo_full_name, webhook_id, webhook_secret, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(repoFullName, hook.id, secret, createdBy, Date.now())

    return { ok: true }
  }

  getWebhookSecret(repoFullName: string): string | null {
    const row = this.db.prepare(
      "SELECT webhook_secret FROM watched_repos WHERE repo_full_name = ?"
    ).get(repoFullName) as { webhook_secret: string } | undefined
    return row?.webhook_secret || null
  }

  getWatchedRepos(): WatchedRepo[] {
    return this.db.prepare(
      "SELECT repo_full_name, webhook_id, created_at FROM watched_repos ORDER BY created_at DESC"
    ).all() as WatchedRepo[]
  }

  recordEvent(deliveryId: string, repo: string, eventType: string, payload: any): boolean {
    const id = crypto.randomUUID()
    const issue = payload.issue
    if (!issue) return false

    const action = payload.action || "unknown"
    const comment = payload.comment

    try {
      this.db.prepare(`
        INSERT INTO webhook_events (id, delivery_id, repo, event_type, action, issue_number, issue_title, comment_body, author, url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        deliveryId,
        repo,
        eventType,
        action,
        issue.number,
        issue.title,
        comment ? (comment.body || "").slice(0, 500) : null,
        (comment?.user?.login || payload.sender?.login || "unknown"),
        comment?.html_url || issue.html_url,
        Date.now()
      )
      return true
    } catch {
      // Duplicate delivery_id
      return false
    }
  }

  getEvents(repo?: string, limit = 50, before?: number): WebhookEvent[] {
    if (repo && before) {
      return this.db.prepare(
        "SELECT * FROM webhook_events WHERE repo = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?"
      ).all(repo, before, limit) as WebhookEvent[]
    }
    if (repo) {
      return this.db.prepare(
        "SELECT * FROM webhook_events WHERE repo = ? ORDER BY created_at DESC LIMIT ?"
      ).all(repo, limit) as WebhookEvent[]
    }
    if (before) {
      return this.db.prepare(
        "SELECT * FROM webhook_events WHERE created_at < ? ORDER BY created_at DESC LIMIT ?"
      ).all(before, limit) as WebhookEvent[]
    }
    return this.db.prepare(
      "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT ?"
    ).all(limit) as WebhookEvent[]
  }
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

const encoder = new TextEncoder()

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false
  const expected = signature.slice(7)

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  const computed = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("")

  // Timing-safe comparison
  if (expected.length !== computed.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ computed.charCodeAt(i)
  }
  return result === 0
}
