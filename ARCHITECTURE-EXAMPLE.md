# Architecture Example: Step-by-Step

This example shows how the new decoupled architecture works in practice.

## Setup: Day 1 (Local Development)

### 1. Register Models

```typescript
// src/model-registry.ts
registerModel({
  name: "claude-3.5-sonnet",
  provider: "anthropic",
  maxTokens: 200000
})
registerModel({
  name: "gpt-4o",
  provider: "openai",
  maxTokens: 128000
})
```

### 2. Create Infrastructure Adapter (DirectAPI)

```typescript
// src/infra-adapters/direct-api.ts
export const createDirectAPIAdapter = (anthropicKey, openaiKey, openrouterKey) => ({
  name: "DirectAPI",
  streamChat: (params) => {
    const provider = getModelProvider(params.model)
    
    if (provider === "anthropic") {
      return callAnthropicSDK(params)
    }
    if (provider === "openai") {
      return callOpenAISDK(params)
    }
    // ... etc
  }
})
```

### 3. Configure Deployment

```typescript
// src/deployments.ts
export const DevelopmentConfig = {
  name: "development",
  routes: [
    { model: "*", infra: "direct-api", priority: 0 }
  ]
}

export const DeploymentFromEnv = Layer.succeed(Deployment)(
  getDeploymentConfig(process.env.DEPLOYMENT ?? "development")
)
```

### 4. Set Up Server

```typescript
// index.ts - Day 1: Simple setup
const adapters = new Map([
  ["direct-api", directAPIAdapter]
])

const appLayers = Layer.mergeAll(
  DevelopmentLive,
  KeyServiceLive,
  RateLimiterLive,
  InfraAdapterRouterLive(adapters)
)

startServer(appLayers, 3000)
```

**Result:** All models route through DirectAPI. Works locally, tests pass.

---

## Expansion: Day 30 (Adding Val.town to Production)

### Step 1: Create Val.town Adapter (No Changes to Existing Code)

```typescript
// src/infra-adapters/val-town.ts (NEW)
export const createValTownAdapter = (config) => ({
  name: "ValTown",
  streamChat: (params) => {
    // Call Val.town endpoint, model-agnostic
    // Val.town endpoint handles "what model is this" internally
    return proxyToValTown(params)
  }
})
```

### Step 2: Register Val.town in Production Config (Configuration Only)

```typescript
// src/deployments.ts (MODIFIED)
export const ProductionConfig = {
  name: "production",
  routes: [
    { model: "*", infra: "val-town", priority: 10 },      // NEW: Route to Val.town
    { model: "*", infra: "direct-api", priority: 0 }      // EXISTING: Fallback
  ]
}
```

### Step 3: Update Server Setup

```typescript
// index.ts (MODIFIED)
const adapters = new Map([
  ["direct-api", directAPIAdapter],
  ["val-town", valTownAdapter]  // NEW
])

const appLayers = Layer.mergeAll(
  DeploymentFromEnv,  // Now respects DEPLOYMENT env var
  KeyServiceLive,
  RateLimiterLive,
  InfraAdapterRouterLive(adapters)
)

startServer(appLayers, 3000)
```

### Step 4: Deploy

```bash
# Local development: still uses DirectAPI
DEPLOYMENT=development node index.ts

# Production: automatically uses Val.town
DEPLOYMENT=production node index.ts
```

**Result:**
- No changes to model registry (still works)
- No changes to DirectAPI adapter (still works)
- Old tests still pass
- Production now uses Val.town automatically
- Automatic fallback to DirectAPI if Val.town fails

---

## Advanced: Day 60 (Model-Specific Routing)

Want different models to use different infrastructure? Just change config:

```typescript
// src/deployments.ts (MODIFIED)
export const SmartProductionConfig = {
  name: "production",
  routes: [
    // Claude models through Val.town (cheaper)
    { model: "claude-*", infra: "val-town", priority: 20 },
    // GPT models direct (lower latency)
    { model: "gpt-*", infra: "direct-api", priority: 20 },
    // Open-source models via OpenRouter
    { model: "meta-*", infra: "direct-api", priority: 15 },
    // Everything else tries Val.town first
    { model: "*", infra: "val-town", priority: 10 },
    // Ultimate fallback
    { model: "*", infra: "direct-api", priority: 0 }
  ]
}
```

**No code changes.** Just configuration.

---

## Emergency: Production Issue (Val.town Down)

### Immediate Fix (1 second)

Option A: Change environment variable
```bash
DEPLOYMENT=development  # Uses DirectAPI
```

Option B: Change routing config
```typescript
// Disable Val.town immediately
routes: [
  // { model: "*", infra: "val-town", priority: 10 },  ← commented out
  { model: "*", infra: "direct-api", priority: 0 }
]
```

**No code recompile. No SDK changes. No adapter logic changes.**

---

## Future: Day 180 (Adding Lambda + Gradual Rollout)

### New Adapter (Follows Same Pattern)

```typescript
// src/infra-adapters/lambda.ts (NEW)
export const createLambdaAdapter = (config) => ({
  name: "Lambda",
  streamChat: (params) => invokeAwsLambda(params)
})
```

### Gradual Rollout Config

```typescript
// src/deployments.ts
export const CanaryConfig = {
  routes: [
    // 90% to Val.town (proven)
    { model: "*", infra: "val-town", priority: 10, percentage: 0.9 },
    // 10% to Lambda (canary)
    { model: "*", infra: "lambda", priority: 10, percentage: 0.1 },
    // Fallback
    { model: "*", infra: "direct-api", priority: 0 }
  ]
}
```

**Monitor metrics, increase percentage gradually:**
```typescript
0.1  // 10% Lambda
0.25 // 25% Lambda
0.5  // 50% Lambda
1.0  // 100% Lambda
```

If Lambda fails at any point, just revert the percentage config.

---

## Data Flow Example

Request arrives: "claude-3.5-sonnet"

```
1. HTTP Request
   POST /v1/chat/completions
   model: "claude-3.5-sonnet"

2. Model Registry Lookup
   getModelProvider("claude-3.5-sonnet") → "anthropic"

3. Infrastructure Router
   routes = ProductionConfig.routes
   matched = { model: "*", infra: "val-town", priority: 10 }
   adapter = adapters.get("val-town")

4. Val.town Adapter Execution
   POST https://my-vt-endpoint.web.val.run/v1/chat/completions
   {
     model: "claude-3.5-sonnet",
     messages: [...],
     privacy: 0.8
   }

5. Val.town Endpoint Logic
   "claude-3.5-sonnet" → call Anthropic SDK
   Handle tokens, streaming, errors

6. Response
   Stream chunks back to client
   Record tokens in budget
   Update quota

7. Alternative Path (if Val.town fails)
   adapter = adapters.get("direct-api")  [priority: 0]
   Calls Anthropic SDK directly
   Same response, just different path
```

---

## Testing Each Layer

### Test: Model Registry
```typescript
test("model registry", () => {
  expect(getModelProvider("claude-3.5-sonnet")).toBe("anthropic")
  expect(getModelProvider("gpt-4o")).toBe("openai")
  expect(getModelInfo("claude-3.5-sonnet").maxTokens).toBe(200000)
})
```

### Test: Router Selection
```typescript
test("router selects correct infra", () => {
  const router = createRouter(adapters, DevelopmentConfig.routes)
  const adapter = router.getAdapter("claude-3.5-sonnet")
  expect(adapter.name).toBe("DirectAPI")
})
```

### Test: Adapters Independently
```typescript
test("DirectAPI adapter", async () => {
  const stream = directAPI.streamChat({
    model: "gpt-4o",
    messages: [{role: "user", content: "hi"}]
  })
  // Stream works, tokens recorded
})

test("ValTown adapter", async () => {
  const stream = valTownAdapter.streamChat({...})
  // Proxy works, streaming works
})
```

### Test: Integration
```typescript
test("end-to-end with ValTown", async () => {
  const layers = setupWithValTown()
  const response = await makeRequest("claude-3.5-sonnet")
  expect(response.status).toBe(200)
  expect(response).toStreamSSE()
  // Tokens recorded, quota updated
})
```

---

## Summary

| Timeframe | What Changes | What Stays Same |
|-----------|--------------|-----------------|
| Day 1 | Nothing | N/A |
| Day 30 | Add ValTown adapter, update config | All models, registrations, tests |
| Day 60 | Update routing rules | Adapters, model registry, tests |
| Day 180 | Add Lambda adapter, new config | Everything else |

The architecture allows you to:
- ✅ Add models without touching adapters
- ✅ Add infrastructure without touching models
- ✅ Change routing without touching either
- ✅ Deploy to different environments with config changes only
- ✅ Roll back in seconds by changing environment variables
