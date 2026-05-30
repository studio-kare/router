# Public Deployment: router.studiokare.nl

## 🎯 Vision

Transform Farmer from a personal LLM router into a **free, public API service** powered by accumulated credits. Launch **router.studiokare.nl** as a community-friendly gateway with:
- Single shared public API key (you control the pool)
- IP-based rate limiting (fair usage)
- Real-time metrics dashboard (monitor abuse)
- Expandable banning system (IP → email verification → allowlists)

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Public Endpoint: router.studiokare.nl                  │
├─────────────────────────────────────────────────────────┤
│  Landing Page (/) + API Docs + Public Metrics           │
├─────────────────────────────────────────────────────────┤
│  POST /v1/chat/completions (public key)                 │
│  ↓                                                        │
│  IP-Based Rate Limiting & Banning Check                │
│  ↓                                                        │
│  Pool Budget Check (daily 10M tokens)                   │
│  ↓                                                        │
│  Route through Privacy-Based Adapter                     │
│  (DirectAPI or Val.town)                                │
├─────────────────────────────────────────────────────────┤
│  SQLite Database                                        │
│  - public_usage (per-IP ledger)                         │
│  - banned_ips (blocklist)                               │
│  - existing api_keys/usage_ledger (unchanged)           │
├─────────────────────────────────────────────────────────┤
│  Admin Dashboard (/admin/metrics)                       │
│  - Per-IP usage breakdown                              │
│  - Daily usage trends                                   │
│  - Ban/unban interface                                  │
│  - Pool status                                          │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Core Components

### 1. Deployment Mode
- **File:** `src/config.ts`
- Add deployment type: `public`
- Configuration:
  ```ts
  export const deploymentConfig = {
    development: { /* existing */ },
    production: { /* existing */ },
    public: {
      type: 'public',
      publicApiKey: process.env.PUBLIC_API_KEY,
      dailyPool: parseInt(process.env.PUBLIC_DAILY_POOL || '10000000'),
      adminToken: process.env.PUBLIC_ADMIN_TOKEN,
      rateLimit: {
        fairLimit: 100,      // req/sec per IP
        abuseLimit: 500,     // req/sec hard cap
        cooldownMs: 300000   // 5 min
      }
    }
  }
  ```

### 2. IP-Based Rate Limiting
- **File:** `src/rate-limit.ts` (modify)
- Track per-IP instead of per-key when in public deployment
- Three tiers per IP:
  - **Fair limit:** 100 requests/second
  - **Abuse limit:** 500 requests/second + 5min cooldown
  - **Daily budget:** Configurable shared pool
- Response headers:
  ```
  X-RateLimit-IpUsage: 45000
  X-RateLimit-PoolRemaining: 9955000
  X-RateLimit-PoolReset: 1685404800
  X-RateLimit-Limit-Per-Second: 100
  X-RateLimit-Remaining-Per-Second: 67
  ```

### 3. IP Usage Ledger
- **File:** `src/public-metrics.ts` (new)
- SQLite table:
  ```sql
  CREATE TABLE public_usage (
    id TEXT PRIMARY KEY,
    ipAddress TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    inputTokens INTEGER NOT NULL,
    outputTokens INTEGER NOT NULL,
    model TEXT NOT NULL,
    costUsd REAL NOT NULL
  );
  CREATE INDEX idx_public_usage_ip_time ON public_usage(ipAddress, timestamp DESC);
  ```
- In-memory tracking for today's usage by IP
- Functions:
  - `recordUsage(ip, inputTokens, outputTokens, model, cost)`
  - `getIpUsageToday(ip) → { used: number, remaining: number }`
  - `getTopIpsByUsage(limit, days) → array`
  - `getDailyUsageByIp() → Map<ip, tokens>`

### 4. Banning System
- **File:** `src/public-bans.ts` (new)
- SQLite table:
  ```sql
  CREATE TABLE banned_ips (
    ipAddress TEXT PRIMARY KEY,
    reason TEXT,
    bannedAt INTEGER,
    bannedBy TEXT
  );
  ```
- Functions:
  - `isIpBanned(ip) → boolean`
  - `banIp(ip, reason) → void`
  - `unbanIp(ip) → void`
  - `getBannedIps() → array`
- Middleware: Check before any public endpoint processing

### 5. Admin API
- **File:** `src/routes.ts` (modify)
- Protected endpoints (require `Authorization: Bearer <PUBLIC_ADMIN_TOKEN>`):
  - `GET /admin/metrics` - Usage breakdown by IP + daily totals
  - `GET /admin/metrics/daily` - Time-series usage last 7 days
  - `GET /admin/pool-status` - Remaining pool, usage rate, ETA to depletion
  - `POST /admin/ban` - Ban an IP: `{ip, reason}`
  - `POST /admin/unban` - Unban an IP: `{ip}`
  - `GET /admin/banned-ips` - List all banned IPs

### 6. Frontend
- **Landing Page:** `frontend/public.html`
  - Hero section explaining what Farmer is
  - Current stats (pool remaining, requests today, top models)
  - Quick start (curl examples)
  - Terms of service (be nice, rate limits, can be banned)
  - Link to `/api-docs`

- **Admin Dashboard:** `frontend/metrics.tsx`
  - Per-IP usage table (sortable by tokens used)
  - Daily usage chart (last 7 days)
  - Ban/unban quick actions
  - Pool status + depletion timeline
  - Banned IPs list with ban reasons

- **API Docs:** `/api-docs`
  - OpenAPI spec for `/v1/chat/completions`
  - Example requests/responses
  - Rate limit headers explained
  - Privacy parameter guide

## 🛣️ Implementation Phases

### Phase 1: Core (3-4 hours)
- [ ] Add public deployment mode config
- [ ] Implement IP-based rate limiting
- [ ] Create public_usage ledger + queries
- [ ] Create banning system
- [ ] Update POST /v1/chat/completions to support public key + IP tracking
- [ ] Add admin API endpoints

### Phase 2: Frontend (2-3 hours)
- [ ] Create public landing page
- [ ] Build admin metrics dashboard
- [ ] Add API docs page
- [ ] Test all flows end-to-end

### Phase 3: Dockerization (1 hour)
- [ ] Create Dockerfile (multi-stage)
- [ ] Create docker-compose.yml (optional)
- [ ] Update .env.example with public vars

### Phase 4: Deployment (varies)
- [ ] Choose host (VPS, Fly.io, Railway, etc)
- [ ] Build + push Docker image
- [ ] Set up DNS: router.studiokare.nl
- [ ] Configure environment variables
- [ ] Test from public internet
- [ ] Monitor initial traffic

## 📋 Configuration Checklist

### Environment Variables
```bash
# Public deployment config
DEPLOYMENT=public
PUBLIC_API_KEY=sk_xxxxxxxxxxxxxxxxxxxx  # Your shared key
PUBLIC_DAILY_POOL=10000000              # 10M tokens/day
PUBLIC_ADMIN_TOKEN=admin_xxxxxxxxxxxxx  # Admin API auth

# Existing config (reuse from production)
VAL_TOWN_ENDPOINT=https://...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
OPENROUTER_API_KEY=...
```

### DNS Setup
```
router.studiokare.nl → [your-server-ip]
```

## 🧪 Testing Checklist

### Local Development
```bash
# Start in public mode
DEPLOYMENT=public bun run index.ts

# Landing page
curl http://localhost:3000/

# Make request with public key
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_public_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]}'

# Check response headers for pool metrics
# Should see: X-RateLimit-PoolRemaining, X-RateLimit-IpUsage, etc

# Test rate limiting
# Fire 150 rapid requests, verify 100+ get rate limited

# Check metrics dashboard
curl http://localhost:3000/admin/metrics \
  -H "Authorization: Bearer admin_xxx"

# Test banning
curl -X POST http://localhost:3000/admin/ban \
  -H "Authorization: Bearer admin_xxx" \
  -H "Content-Type: application/json" \
  -d '{"ip": "127.0.0.1", "reason": "test"}'

# Verify banned IP gets 403
curl http://localhost:3000/v1/chat/completions ... 
# Expected: 403 Forbidden
```

### Production
- [ ] Test from external IP (not localhost)
- [ ] Verify rate limiting works across distributed requests
- [ ] Check metrics dashboard with real traffic
- [ ] Monitor pool depletion rate
- [ ] Test banning + verify user can't access after ban

## 📈 Monitoring & Sustainability

### Daily Monitoring
- [ ] Check pool remaining (email alert if <20% remaining)
- [ ] Review metrics dashboard for abuse patterns
- [ ] Check for new banned IPs needed

### Weekly Review
- [ ] Top IPs by usage
- [ ] Most popular models
- [ ] Error rates/patterns
- [ ] Cost per request (to understand depletion rate)

### Monthly Review
- [ ] Usage trends
- [ ] Pool depletion projection
- [ ] Feedback/requests from community
- [ ] Evolution of banning rules (→ email verification?)

## 🚀 Future Enhancements

### Phase 2: Email Verification (2-4 weeks)
- Users send email in `X-User-Email` header
- Verify email via confirmation link
- Per-email quota instead of per-IP
- Allowlist management

### Phase 3: Community Features
- Public usage dashboard (anonymized)
- Model popularity leaderboard
- User testimonials
- Integration examples (Python SDK, Node SDK)

### Phase 4: Sustainability
- Donation model (Stripe button)
- Sponsor/credits for open source projects
- Referral bonuses
- Premium tier (faster routing, higher quotas)

## 📝 Success Metrics

- [ ] Public landing page loads in <1s
- [ ] API endpoint responds in <300ms average
- [ ] Rate limiting prevents abuse (no single IP >10% pool)
- [ ] Metrics dashboard accurate + useful
- [ ] Community feedback positive
- [ ] No data leaks or security issues

## 🔒 Security Considerations

- [ ] Admin token is strong (32+ random chars)
- [ ] IP is validated (not spoofable via headers initially)
- [ ] Rate limits enforced strictly
- [ ] SQL injection prevention (parameterized queries)
- [ ] No API keys exposed in logs/errors
- [ ] HTTPS only for production
- [ ] Admin endpoints not listed in public docs

## 📞 FAQ

**Q: What if someone uses all the credits?**
A: Daily pool resets at midnight. Monitor via dashboard, ban if egregious.

**Q: How do I evolve beyond IP-based banning?**
A: Add email header → email verification → per-email quotas.

**Q: Can I run this on my personal VPS?**
A: Yes! It's stateless (SQLite only) and containerized.

**Q: What if I want to charge later?**
A: Keep pool limit low initially, add payment layer later if needed.

**Q: How do I handle abuse?**
A: Start with monitoring + manual bans. Upgrade to email verification if spam increases.

## 🎯 MVP (Minimum Viable Product)

See `MVP_PLAN.md` for a focused implementation roadmap that delivers the essentials in 1-2 days.
