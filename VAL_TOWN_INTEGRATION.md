# Val.town Integration Guide for Farmer

This guide shows how to integrate your Val.town endpoint with Farmer and enable the attribution + ejection path strategy.

## 🎯 The Business Model

### Phase 1: Attribution (Now)
```
User Request
  ↓
Farmer (your deployment)
  ↓
Your Val.town Endpoint
  ↓
Your Val.town Account gets usage attribution
  ↓
Marketing win: Steve sees Farmer traffic on your profile
```

### Phase 2: Ejection (Later)
```
User wants to self-host
  ↓
User deploys their own copy of the endpoint
  ↓
User gets their own endpoint URL
  ↓
User replaces your endpoint URL in their Farmer config
  ↓
User's traffic goes through their Val.town account
  ↓
Everyone wins: You get attribution, users get control
```

## Setup Steps

### Step 1: Deploy Val.town Endpoint

Follow `vt-endpoint/DEPLOYMENT.md`:

1. Create HTTP val on Val.town
2. Copy code from `vt-endpoint/main.ts`
3. Set API keys
4. Get endpoint URL: `https://your-username-farmer.web.val.run`

### Step 2: Configure Farmer Production

Update your Farmer configuration to use Val.town:

```typescript
// src/deployments.ts
export const ProductionConfig: DeploymentConfig = {
  name: "production",
  description: "Production - routes through Val.town for cost optimization",
  routes: [
    // Primary: Your Val.town endpoint (attribution!)
    { model: "*", infra: "val-town", priority: 10 },
    // Fallback: DirectAPI if Val.town fails
    { model: "*", infra: "direct-api", priority: 0 }
  ]
}
```

### Step 3: Set Environment Variables

```bash
# .env.production
DEPLOYMENT=production
VAL_TOWN_ENDPOINT=https://your-username-farmer.web.val.run
```

Or in code:

```typescript
// index.ts
const valTownAdapter = createValTownAdapter({
  endpointUrl: process.env.VAL_TOWN_ENDPOINT ||
    "https://your-username-farmer.web.val.run"
})

const adapters = new Map([
  ["direct-api", directAPIAdapter],
  ["val-town", valTownAdapter]
])
```

### Step 4: Deploy Farmer

```bash
DEPLOYMENT=production npm start
# or
DEPLOYMENT=production bun run index.ts
```

### Step 5: Verify Attribution

Go to https://val.town/u/your-username

You should see:
- Your endpoint val listed
- Usage graphs showing Farmer traffic
- Request/response logs

## Attribution Strategy

### What Gets Tracked

On your Val.town profile:
```
farmer (HTTP val)
├── Requests: 1,234
├── Success rate: 99.8%
├── Response time: 450ms avg
├── Source: https://farmer.example.com
└── Usage breakdown by model
```

### Marketing Angle

Share with Steve and others:
> "Using Farmer on Val.town: 1,200+ daily requests, multiple LLM providers, seamless integration"

Link: `https://val.town/u/your-username`

## Ejection Path Implementation

### Option A: Self-Service (Recommended)

Provide users with a one-click deploy:

```typescript
// frontend.tsx or UI component
const EjectButton = () => {
  const TEMPLATE_URL = encodeURIComponent(
    "https://raw.githubusercontent.com/yourusername/farmer/main/vt-endpoint/main.ts"
  )
  
  return (
    <a 
      href={`https://val.town/new?name=farmer-endpoint&content=${TEMPLATE_URL}`}
      target="_blank"
      className="button"
    >
      Deploy Your Own Endpoint
    </a>
  )
}
```

Users click → Val.town creates a copy → They set API keys → Done

### Option B: Documentation

In your README or dashboard:

```markdown
## Self-Host on Val.town

Want complete control? Deploy your own endpoint:

1. Go to [Val.town](https://val.town)
2. Create a new HTTP val
3. Copy code from [vt-endpoint/main.ts](link)
4. Set your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
5. Get your endpoint URL
6. In Farmer, set: `VAL_TOWN_ENDPOINT=<your-endpoint-url>`

Your traffic now routes through your Val.town account!
```

### Option C: GitHub Template

Create a template repository:

```
github.com/yourusername/farmer-vt-endpoint-template
```

Users can:
1. Click "Use this template"
2. Get a copy in their account
3. Deploy to Val.town
4. Set API keys
5. Use in Farmer

## Tracking Attribution

### For You (Creator)

Monitor your endpoint usage:

```typescript
// In your Val.town endpoint, add logging
export default async function handler(req: Request) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: new URL(req.url).pathname,
    model: (await req.json()).model,
    // ... more details
  }
  
  console.log(logEntry)  // Appears in Val.town logs
}
```

### For Users (Post-Ejection)

When users deploy their own copy:

```typescript
// They see their own usage in their Val.town dashboard
// They can track costs per model
// They have complete transparency
```

## Revenue/Cost Model

### Your Val.town Endpoint (Phase 1)
```
Your API Keys
├── Cost: You pay for all requests
├── Attribution: Your account shows all usage
├── Sustainability: Part of Farmer business model
└── Benefit: Network effect, marketing attribution
```

### User's Val.town Endpoint (Phase 2)
```
User's API Keys
├── Cost: User pays for their requests
├── Attribution: User's account shows their usage
├── Control: Users own their infrastructure
└── Benefit: You get adoption + data on which models are popular
```

## Hybrid Model (Optional)

You could also offer tiered usage:

```
Free Tier:
  → Routes through your Val.town endpoint
  → You pay for API costs
  → Limited to 1,000 requests/day

Pro Tier:
  → User brings their own API keys
  → User's API keys used directly
  → User pays for API costs
  → Unlimited requests

Enterprise:
  → User deploys their own endpoint
  → Complete control + transparency
  → Support + integration help
```

## Configuration Examples

### Development (Your Machine)
```bash
DEPLOYMENT=development
# Uses DirectAPI with your local keys
```

### Staging (Test Val.town Integration)
```bash
DEPLOYMENT=staging
VAL_TOWN_ENDPOINT=https://your-username-farmer-staging.web.val.run
# Uses your staging Val.town endpoint
```

### Production (Your Marketing Attribution)
```bash
DEPLOYMENT=production
VAL_TOWN_ENDPOINT=https://your-username-farmer.web.val.run
# Routes through YOUR Val.town endpoint
# All usage attributed to you
```

### User Self-Hosted (Post-Ejection)
```bash
DEPLOYMENT=production
VAL_TOWN_ENDPOINT=https://their-username-farmer.web.val.run
# Routes through THEIR Val.town endpoint
# All usage attributed to them
```

## Monitoring Dashboard

You could create a simple dashboard showing:

```
Farmer Val.town Attribution
├── Total requests: 12,456
├── Unique users: 234
├── Models used:
│   ├── claude-3.5-sonnet: 5,432 (44%)
│   ├── gpt-4o: 4,123 (33%)
│   └── llama-3.1: 2,901 (23%)
├── Success rate: 99.8%
├── Avg response time: 450ms
└── Ejected users: 12
```

Pull from:
1. Val.town logs
2. Your Farmer database (token usage)
3. Rate limiter metrics

## Best Practices

### 1. Keep Endpoint Simple
- Minimal dependencies
- Fast cold start
- Easy to fork/eject

### 2. Document Configuration
- Clear instructions for API keys
- Troubleshooting guide
- Model list

### 3. Monitor Usage
- Log requests (for debugging)
- Track errors
- Watch performance

### 4. Provide Support
- Respond to issues
- Help with ejection
- Share best practices

### 5. Iterate Fast
- Update endpoint code
- Add new models
- Optimize performance

## Next Steps

1. ✅ Deploy Val.town endpoint (15 minutes)
2. ✅ Configure Farmer to use it (5 minutes)
3. ✅ Test end-to-end (10 minutes)
4. ✅ Monitor attribution in Val.town (ongoing)
5. ✅ Market to Steve (asap!)
6. ✅ Add ejection button to UI (later)
7. ✅ Document self-hosting instructions (later)

## Summary

This strategy gives you:
- ✅ **Attribution**: Your Val.town profile shows Farmer traffic
- ✅ **Marketing**: Demonstrates product on Val.town
- ✅ **Control**: You own the primary endpoint
- ✅ **Scalability**: Users can self-host when needed
- ✅ **Network Effect**: More deployments = more visibility
- ✅ **Data**: See which models are popular
- ✅ **Win-Win**: Users get control, you get attribution
