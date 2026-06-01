import { Database } from "bun:sqlite"

export interface GithubUser {
  github_id: number
  username: string
  avatar_url: string | null
  created_at: number
  last_login: number
}

export class AuthService {
  private db: Database
  private clientId: string
  private clientSecret: string
  private allowedUsers: Set<string>
  private callbackUrl: string

  constructor(opts: {
    dbPath: string
    clientId: string
    clientSecret: string
    allowedUsers: string[]
    callbackUrl: string
  }) {
    this.db = new Database(opts.dbPath)
    this.clientId = opts.clientId
    this.clientSecret = opts.clientSecret
    this.allowedUsers = new Set(opts.allowedUsers.map((u) => u.toLowerCase()))
    this.callbackUrl = opts.callbackUrl
    this.initTables()
    this.cleanExpiredSessions()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS github_users (
        github_id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        avatar_url TEXT,
        access_token TEXT,
        created_at INTEGER NOT NULL,
        last_login INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        github_user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (github_user_id) REFERENCES github_users(github_id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `)

    // Migration: add access_token column if missing
    try {
      this.db.exec("ALTER TABLE github_users ADD COLUMN access_token TEXT")
    } catch {
      // Column already exists
    }
  }

  getAuthorizeUrl(): { url: string; state: string } {
    const state = crypto.randomUUID()
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: "read:user read:repo_hook write:repo_hook",
      state,
    })
    return {
      url: `https://github.com/login/oauth/authorize?${params}`,
      state,
    }
  }

  async handleCallback(code: string): Promise<{ sessionToken: string; user: GithubUser } | { error: string }> {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    })

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
    if (!tokenData.access_token) {
      return { error: tokenData.error || "Failed to get access token" }
    }

    // Fetch user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    })

    if (!userRes.ok) {
      return { error: "Failed to fetch user info from GitHub" }
    }

    const userData = (await userRes.json()) as {
      id: number
      login: string
      avatar_url: string
    }

    // Check allowlist
    if (!this.allowedUsers.has(userData.login.toLowerCase())) {
      return { error: `User ${userData.login} is not authorized` }
    }

    const now = Date.now()

    // Upsert user
    this.db.prepare(`
      INSERT INTO github_users (github_id, username, avatar_url, access_token, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(github_id) DO UPDATE SET
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        access_token = excluded.access_token,
        last_login = excluded.last_login
    `).run(userData.id, userData.login, userData.avatar_url, tokenData.access_token, now, now)

    // Create session (7 days)
    const sessionToken = generateSessionToken()
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000

    this.db.prepare(`
      INSERT INTO sessions (token, github_user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionToken, userData.id, now, expiresAt)

    const user: GithubUser = {
      github_id: userData.id,
      username: userData.login,
      avatar_url: userData.avatar_url,
      created_at: now,
      last_login: now,
    }

    return { sessionToken, user }
  }

  validateSession(token: string): GithubUser | null {
    const row = this.db.prepare(`
      SELECT u.github_id, u.username, u.avatar_url, u.created_at, u.last_login
      FROM sessions s
      JOIN github_users u ON s.github_user_id = u.github_id
      WHERE s.token = ? AND s.expires_at > ?
    `).get(token, Date.now()) as GithubUser | undefined

    return row || null
  }

  destroySession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token)
  }

  getAccessToken(githubId: number): string | null {
    const row = this.db.prepare(
      "SELECT access_token FROM github_users WHERE github_id = ?"
    ).get(githubId) as { access_token: string | null } | undefined
    return row?.access_token || null
  }

  cleanExpiredSessions(): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now())
  }
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function parseCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie")
  if (!header) return null
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`))
  return match ? match.split("=")[1].trim() : null
}

export function getSessionUser(req: Request, auth: AuthService): GithubUser | null {
  const token = parseCookie(req, "session")
  if (!token) return null
  return auth.validateSession(token)
}

export function sessionCookie(token: string, secure: boolean): string {
  const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure ? "; Secure" : ""}`
  return `session=${token}; ${flags}`
}

export function clearSessionCookie(secure: boolean): string {
  const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`
  return `session=; ${flags}`
}

export function stateCookie(state: string, secure: boolean): string {
  const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure ? "; Secure" : ""}`
  return `oauth_state=${state}; ${flags}`
}

export function parseStateCookie(req: Request): string | null {
  return parseCookie(req, "oauth_state")
}
