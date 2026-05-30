# MVP Plan: Public Router (1-2 Days)

## 🎯 MVP Scope

**Goal:** Get a working public API at router.studiokare.nl with basic rate limiting and monitoring.

**What's included:**
- ✅ Public API endpoint with shared key
- ✅ Per-IP rate limiting (prevent abuse)
- ✅ IP usage tracking in SQLite
- ✅ Basic metrics dashboard for you (admin only)
- ✅ Banning infrastructure (manual)
- ✅ Dockerized for deployment
- ✅ Simple landing page

**What's deferred:**
- ❌ Email verification (Phase 2)
- ❌ Public stats/leaderboards
- ❌ Fancy analytics charts (just tables for now)
- ❌ Automated abuse detection
- ❌ Usage warnings via email

---

## 📋 Day 1: Core Implementation (4-5 hours)

### Step 1: Add Public Mode Config (30 mins)

**File:** `src/config.ts`

```ts
export const deploymentConfig = {
  // ... existing configs ...
  
  public: {
    type: 'public' as const,
    publicApiKey: process.env.PUBLIC_API_KEY || '',
    dailyPoolTokens: parseInt(process.env.PUBLIC_DAILY_POOL || '10000000'),
    adminToken: process.env.PUBLIC_ADMIN_TOKEN || '',
    rateLimit: {
      fairLimitPerSecond: 100,
      abuseLimitPerSecond: 500,
      cooldownMs: 300000, // 5 min
    }
  }
}
```

Add to `.env.example`:
```bash
# Public deployment
DEPLOYMENT=public
PUBLIC_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PUBLIC_DAILY_POOL=10000000
PUBLIC_ADMIN_TOKEN=admin_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Test:** Verify config loads correctly
```bash
DEPLOYMENT=public bun run index.ts
# Should see "Deployment: public" in logs
```

---

### Step 2: Modify Rate Limiter for IP Tracking (60 mins)

**File:** `src/rate-limit.ts`

Add IP-based tracking alongside existing key-based:

```ts
// Add to RateLimiter service
class PublicRateLimiter {
  private ipBuckets = new Map<string, TokenBucket>()
  private dailyIpUsage = new Map<string, number>() // resets daily
  
  checkLimit(ip: string, config: RateLimitConfig): {
    allowed: boolean
    remaining: number
    resetAt?: number
  } {
    // Fair limit (100 req/sec token bucket)
    const bucket = this.ipBuckets.get(ip) || new TokenBucket(config.fairLimitPerSecond)
    if (!bucket.tryConsume(1)) {
      return { allowed: false, remaining: 0 }
    }
    this.ipBuckets.set(ip, bucket)
    
    // Track usage
    const used = this.dailyIpUsage.get(ip) || 0
    return { 
      allowed: true, 
      remaining: bucket.tokensRemaining,
      resetAt: bucket.resetAt
    }
  }
  
  recordTokens(ip: string, tokens: number) {
    const current = this.dailyIpUsage.get(ip) || 0
    this.dailyIpUsage.set(ip, current + tokens)
  }
  
  getIpUsageToday(ip: string): number {
    return this.dailyIpUsage.get(ip) || 0
  }
  
  getAllIpUsage(): Map<string, number> {
    return new Map(this.dailyIpUsage)
  }
  
  resetDaily() {
    this.dailyIpUsage.clear()
  }
}

export const createPublicRateLimiter = () => new PublicRateLimiter()
```

**Test:** Rate limiting works
```bash
# Rapid fire requests, verify ~100 succeed then fail
for i in {1..150}; do
  curl -s http://localhost:3000/v1/chat/completions \
    -H "Authorization: Bearer sk_public_xxx" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}' \
    -w "%{http_code}\n" | tail -1
done | sort | uniq -c
# Should see ~100 200s, ~50 429s
```

---

### Step 3: Create Public Metrics Table (30 mins)

**File:** `src/public-metrics.ts`

```ts
import { Database } from "bun:sqlite"

export class PublicMetrics {
  private db: Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.init()
  }

  private init() {
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
    `)
  }

  recordUsage(data: {
    ip: string
    inputTokens: number
    outputTokens: number
    model: string
    costUsd: number
  }) {
    const id = crypto.randomUUID()
    const timestamp = Date.now()
    
    this.db.prepare(`
      INSERT INTO public_usage 
        (id, ipAddress, timestamp, inputTokens, outputTokens, model, costUsd)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.ip,
      timestamp,
      data.inputTokens,
      data.outputTokens,
      data.model,
      data.costUsd
    )
  }

  getTopIpsByUsage(limit = 20) {
    return this.db.prepare(`
      SELECT 
        ipAddress,
        COUNT(*) as requestCount,
        SUM(inputTokens) + SUM(outputTokens) as totalTokens,
        SUM(costUsd) as totalCost
      FROM public_usage
      WHERE timestamp > ? -- last 24 hours
      GROUP BY ipAddress
      ORDER BY totalTokens DESC
      LIMIT ?
    `).all(Date.now() - 86400000, limit) as any[]
  }

  getTodayUsage() {
    return this.db.prepare(`
      SELECT 
        SUM(inputTokens) + SUM(outputTokens) as totalTokens,
        COUNT(*) as requestCount
      FROM public_usage
      WHERE timestamp > ?
    `).get(Date.now() - 86400000) as { totalTokens: number; requestCount: number }
  }

  getIpUsageToday(ip: string) {
    const row = this.db.prepare(`
      SELECT SUM(inputTokens) + SUM(outputTokens) as totalTokens
      FROM public_usage
      WHERE ipAddress = ? AND timestamp > ?
    `).get(ip, Date.now() - 86400000) as { totalTokens: number | null }
    
    return row?.totalTokens ?? 0
  }
}

export const createPublicMetrics = (dbPath: string) => new PublicMetrics(dbPath)
```

**Test:** Metrics recording works
```bash
# Make a request, check DB
sqlite3 farmer.db "SELECT * FROM public_usage LIMIT 1"
```

---

### Step 4: Create Banning System (30 mins)

**File:** `src/public-bans.ts`

```ts
import { Database } from "bun:sqlite"

export class BanManager {
  private db: Database
  private bannedIps = new Set<string>()

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.init()
    this.loadBans()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS banned_ips (
        ipAddress TEXT PRIMARY KEY,
        reason TEXT,
        bannedAt INTEGER,
        bannedBy TEXT
      );
    `)
  }

  private loadBans() {
    const rows = this.db.prepare(`SELECT ipAddress FROM banned_ips`).all() as any[]
    this.bannedIps = new Set(rows.map(r => r.ipAddress))
  }

  isBanned(ip: string): boolean {
    return this.bannedIps.has(ip)
  }

  ban(ip: string, reason: string, bannedBy = 'admin') {
    this.db.prepare(`
      INSERT OR REPLACE INTO banned_ips 
        (ipAddress, reason, bannedAt, bannedBy)
      VALUES (?, ?, ?, ?)
    `).run(ip, reason, Date.now(), bannedBy)
    
    this.bannedIps.add(ip)
  }

  unban(ip: string) {
    this.db.prepare(`DELETE FROM banned_ips WHERE ipAddress = ?`).run(ip)
    this.bannedIps.delete(ip)
  }

  getBannedIps() {
    return this.db.prepare(`
      SELECT ipAddress, reason, bannedAt, bannedBy
      FROM banned_ips
      ORDER BY bannedAt DESC
    `).all() as any[]
  }
}

export const createBanManager = (dbPath: string) => new BanManager(dbPath)
```

**Test:** Banning works
```bash
# Ban an IP via admin endpoint (we'll add next)
# Verify requests from that IP fail
```

---

### Step 5: Update Main Routes (90 mins)

**File:** `src/index.ts` (or routes.ts)

Key changes:
1. Check deployment type
2. For public: use public key, IP-based rate limiting, banning checks
3. Add admin endpoints
4. Return pool metrics in headers

**Pseudo-code:**
```ts
const publicRateLimiter = createPublicRateLimiter()
const publicMetrics = createPublicMetrics('./farmer.db')
const banManager = createBanManager('./farmer.db')

Bun.serve({
  routes: {
    // Public landing page
    '/': () => new Response(PUBLIC_HTML, { headers: { 'Content-Type': 'text/html' } }),
    
    // Public API
    '/v1/chat/completions': {
      POST: async (req) => {
        const deployment = process.env.DEPLOYMENT || 'development'
        
        if (deployment === 'public') {
          const ip = req.headers.get('x-forwarded-for') || 'unknown'
          
          // Check ban
          if (banManager.isBanned(ip)) {
            return new Response('Banned', { status: 403 })
          }
          
          // Check rate limit
          const rateCheck = publicRateLimiter.checkLimit(ip, config.public.rateLimit)
          if (!rateCheck.allowed) {
            return new Response('Rate limited', { status: 429 })
          }
          
          // Check auth (public key)
          const auth = req.headers.get('Authorization')
          if (auth !== `Bearer ${process.env.PUBLIC_API_KEY}`) {
            return new Response('Unauthorized', { status: 401 })
          }
          
          // Process request... (existing logic)
          // Record usage: publicMetrics.recordUsage(...)
          // Add headers with pool info
          
          return streamingResponse // with headers
        } else {
          // Existing logic for development/production
        }
      }
    },
    
    // Admin metrics (protected)
    '/admin/metrics': {
      GET: (req) => {
        const auth = req.headers.get('Authorization')
        if (auth !== `Bearer ${process.env.PUBLIC_ADMIN_TOKEN}`) {
          return new Response('Unauthorized', { status: 401 })
        }
        
        const topIps = publicMetrics.getTopIpsByUsage(20)
        const today = publicMetrics.getTodayUsage()
        const banned = banManager.getBannedIps()
        
        return Response.json({
          topIps,
          today,
          banned,
          poolRemaining: config.public.dailyPoolTokens - (today?.totalTokens ?? 0)
        })
      }
    },
    
    // Ban/unban (protected)
    '/admin/ban': {
      POST: async (req) => {
        const auth = req.headers.get('Authorization')
        if (auth !== `Bearer ${process.env.PUBLIC_ADMIN_TOKEN}`) {
          return new Response('Unauthorized', { status: 401 })
        }
        
        const { ip, reason } = await req.json()
        banManager.ban(ip, reason)
        return Response.json({ ok: true })
      }
    },
    
    '/admin/unban': {
      POST: async (req) => {
        const auth = req.headers.get('Authorization')
        if (auth !== `Bearer ${process.env.PUBLIC_ADMIN_TOKEN}`) {
          return new Response('Unauthorized', { status: 401 })
        }
        
        const { ip } = await req.json()
        banManager.unban(ip)
        return Response.json({ ok: true })
      }
    }
  }
})
```

**Test:** All endpoints work
```bash
# Landing page
curl http://localhost:3000/

# Public key request
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_public_xxx" ...

# Admin check
curl http://localhost:3000/admin/metrics \
  -H "Authorization: Bearer admin_xxx"
```

---

## 📋 Day 2: Frontend & Polish (3-4 hours)

### Step 6: Create Public Landing Page (60 mins)

**File:** `frontend/public.html`

Simple, clean page with:
- Hero: "Free LLM API powered by accumulated credits"
- Quick start (curl example)
- Current stats (pool remaining, requests today)
- Rate limits explained
- Terms of service
- Link to docs

```html
<!DOCTYPE html>
<html>
<head>
  <title>Farmer: Free LLM Router</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    .stat { display: inline-block; margin: 20px 20px 0 0; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f0f0f0; padding: 10px; overflow: auto; }
  </style>
</head>
<body>
  <h1>🌾 Farmer: Free LLM Router</h1>
  <p>An intelligent LLM API gateway powered by accumulated credits. Free for everyone.</p>
  
  <h2>📊 Stats</h2>
  <div class="stat">
    <strong id="pool-remaining">--</strong><br>
    <small>Tokens remaining today</small>
  </div>
  <div class="stat">
    <strong id="requests-today">--</strong><br>
    <small>Requests processed</small>
  </div>
  
  <h2>🚀 Quick Start</h2>
  <pre><code>curl -X POST https://router.studiokare.nl/v1/chat/completions \
  -H "Authorization: Bearer sk_public_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'</code></pre>
  
  <h2>📏 Rate Limits</h2>
  <ul>
    <li>100 requests/second per IP (fair limit)</li>
    <li>500 requests/second hard ceiling (5min cooldown)</li>
    <li>10M tokens/day shared pool</li>
    <li>Daily pool resets at midnight UTC</li>
  </ul>
  
  <h2>⚠️ Terms</h2>
  <ul>
    <li>Be respectful of the shared pool</li>
    <li>No abuse, crawling, or load testing</li>
    <li>IPs violating limits may be banned</li>
    <li>No SLA: service may go down</li>
    <li>For serious usage, run your own deployment</li>
  </ul>
  
  <h2>📚 Resources</h2>
  <ul>
    <li><a href="/api-docs">API Documentation</a></li>
    <li><a href="https://github.com/...">GitHub</a></li>
  </ul>
  
  <script>
    // Fetch stats
    fetch('/public/stats')
      .then(r => r.json())
      .then(d => {
        document.getElementById('pool-remaining').textContent = 
          (d.poolRemaining || 0).toLocaleString()
        document.getElementById('requests-today').textContent = 
          (d.requestsToday || 0).toLocaleString()
      })
      .catch(() => {})
  </script>
</body>
</html>
```

Add endpoint:
```ts
'/public/stats': {
  GET: () => {
    const today = publicMetrics.getTodayUsage()
    const remaining = config.public.dailyPoolTokens - (today?.totalTokens ?? 0)
    return Response.json({
      poolRemaining: remaining,
      requestsToday: today?.requestCount ?? 0
    })
  }
}
```

**Test:** Landing page loads and shows stats

---

### Step 7: Create Admin Dashboard (60 mins)

**File:** `frontend/admin.html`

Simple table-based dashboard (no charts for MVP):
- Top IPs by usage
- Current usage
- Banned IPs
- Ban/unban buttons

```html
<!DOCTYPE html>
<html>
<head>
  <title>Farmer Admin</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
    button { padding: 5px 10px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
    .danger { background: #dc3545; }
  </style>
</head>
<body>
  <h1>⚙️ Farmer Admin</h1>
  
  <h2>📊 Pool Status</h2>
  <div>
    <strong>Used Today:</strong> <span id="used-today">--</span> /
    <strong>Pool:</strong> <span id="pool-size">--</span>
  </div>
  <div id="progress-bar" style="margin: 10px 0;">
    <div style="height: 20px; background: #eee; border-radius: 3px;">
      <div id="progress" style="height: 100%; background: #28a745; border-radius: 3px; width: 0%; transition: width 0.2s;"></div>
    </div>
  </div>
  
  <h2>🔝 Top IPs</h2>
  <table id="top-ips-table">
    <thead>
      <tr>
        <th>IP Address</th>
        <th>Tokens Used</th>
        <th>Requests</th>
        <th>Cost</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="top-ips-body"></tbody>
  </table>
  
  <h2>🚫 Banned IPs</h2>
  <table id="banned-table">
    <thead>
      <tr>
        <th>IP</th>
        <th>Reason</th>
        <th>Banned At</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="banned-body"></tbody>
  </table>
  
  <script>
    const adminToken = prompt('Enter admin token:')
    if (!adminToken) location.href = '/'
    
    const headers = { 'Authorization': `Bearer ${adminToken}` }
    
    // Fetch metrics
    async function refresh() {
      const resp = await fetch('/admin/metrics', { headers })
      if (!resp.ok) {
        alert('Unauthorized')
        location.href = '/'
        return
      }
      
      const data = await resp.json()
      
      // Pool status
      const used = data.today?.totalTokens ?? 0
      const pool = 10000000
      const pct = (used / pool) * 100
      
      document.getElementById('used-today').textContent = used.toLocaleString()
      document.getElementById('pool-size').textContent = pool.toLocaleString()
      document.getElementById('progress').style.width = pct + '%'
      
      // Top IPs
      const tbody = document.getElementById('top-ips-body')
      tbody.innerHTML = data.topIps.map(ip => `
        <tr>
          <td>${ip.ipAddress}</td>
          <td>${ip.totalTokens?.toLocaleString() ?? 0}</td>
          <td>${ip.requestCount ?? 0}</td>
          <td>$${(ip.totalCost ?? 0).toFixed(2)}</td>
          <td>
            <button onclick="banIp('${ip.ipAddress}')">Ban</button>
          </td>
        </tr>
      `).join('')
      
      // Banned IPs
      const banned = document.getElementById('banned-body')
      banned.innerHTML = data.banned.map(b => `
        <tr>
          <td>${b.ipAddress}</td>
          <td>${b.reason}</td>
          <td>${new Date(b.bannedAt).toLocaleString()}</td>
          <td>
            <button class="danger" onclick="unbanIp('${b.ipAddress}')">Unban</button>
          </td>
        </tr>
      `).join('')
    }
    
    async function banIp(ip) {
      const reason = prompt('Ban reason:')
      if (!reason) return
      
      const resp = await fetch('/admin/ban', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, reason })
      })
      
      if (resp.ok) refresh()
      else alert('Failed to ban IP')
    }
    
    async function unbanIp(ip) {
      if (!confirm(`Unban ${ip}?`)) return
      
      const resp = await fetch('/admin/unban', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      })
      
      if (resp.ok) refresh()
      else alert('Failed to unban IP')
    }
    
    // Auto-refresh every 10 seconds
    refresh()
    setInterval(refresh, 10000)
  </script>
</body>
</html>
```

Add endpoint:
```ts
'/admin': {
  GET: () => new Response(ADMIN_HTML, { headers: { 'Content-Type': 'text/html' } })
}
```

**Test:** Admin dashboard loads, shows metrics, can ban/unban

---

### Step 8: Dockerization (30 mins)

**File:** `Dockerfile`

```dockerfile
FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .
RUN bun install

COPY src src
COPY frontend frontend
COPY index.ts .

EXPOSE 3000

CMD ["bun", "run", "index.ts"]
```

**File:** `.dockerignore`

```
node_modules
.git
.env
farmer.db
```

**Test:** Build and run
```bash
docker build -t farmer-public .
docker run -e DEPLOYMENT=public -e PUBLIC_API_KEY=sk_xxx -p 3000:3000 farmer-public
```

---

## ✅ MVP Validation Checklist

### Core Functionality
- [ ] Public key works (returns 401 for wrong key)
- [ ] Rate limiting works (100 req/sec per IP)
- [ ] Pool remaining shown in response headers
- [ ] Metrics recorded in database
- [ ] Admin metrics endpoint returns correct data

### Admin
- [ ] Can view top IPs
- [ ] Can ban/unban IPs
- [ ] Banned IPs get 403
- [ ] Dashboard auto-refreshes

### Frontend
- [ ] Landing page loads
- [ ] Landing page shows pool stats
- [ ] Admin dashboard loads (with token)
- [ ] All links work

### Docker
- [ ] Builds successfully
- [ ] Runs and serves requests
- [ ] Database persists across restarts

### Deployment-Ready
- [ ] .env.example has all vars
- [ ] No hardcoded secrets in code
- [ ] Logging shows deployment type
- [ ] Error messages are user-friendly

---

## 🚀 After MVP: Next Steps

Once MVP is deployed and stable:

1. **Week 1:** Monitor traffic, adjust rate limits if needed
2. **Week 2:** Collect feedback, refine UX
3. **Week 3:** Add email verification (Phase 2)
4. **Week 4:** Add analytics dashboard (Phase 3)

---

## 📞 Key Files to Create/Modify

**Create:**
- `src/public-metrics.ts` - IP usage tracking
- `src/public-bans.ts` - Banning system
- `frontend/public.html` - Landing page
- `frontend/admin.html` - Admin dashboard
- `Dockerfile` - Container image

**Modify:**
- `src/index.ts` - Add public routes + rate limiting
- `src/config.ts` - Add public deployment config
- `src/rate-limit.ts` - Add IP-based limiting
- `.env.example` - Document public vars

---

## ⏱️ Time Estimate

- **Day 1 (4-5 hours):** Steps 1-5 (config, rate limiter, metrics, banning, routes)
- **Day 2 (3-4 hours):** Steps 6-8 (landing page, admin, docker)
- **Total:** 7-9 hours

Ready to start? Let me know which step to begin with!
