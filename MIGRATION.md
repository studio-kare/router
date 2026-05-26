# Migration Guide: Model + Infrastructure Decoupling

This guide shows how to migrate from the old monolithic adapter architecture to the new decoupled system.

## Before: Monolithic Adapters

```typescript
// Old approach: adapters tightly coupled to providers AND infrastructure
import { AnthropicAdapter } from "./adapters/anthropic"     // SDK + direct API calls
import { OpenAIAdapter } from "./adapters/openai"           // SDK + direct API calls
import { OpenRouterAdapter } from "./adapters/openrouter"   // SDK + direct API calls

// Privacy-based routing logic decides which adapter to use
const selectAndStream = (privacy) => {
  if (privacy > 0.8) return AnthropicAdapter
  if (privacy > 0.5) return OpenAIAdapter
  return OpenRouterAdapter
}
```

**Problems:**
- To add Val.town support, need to create AnthropicViaValTown, OpenAIViaValTown, OpenRouterViaValTown
- Adding a new model requires updating adapters
- Can't easily switch infrastructure providers

## After: Decoupled System

### Step 1: Register Models

```typescript
// src/model-registry.ts
import { registerModel } from "./model-registry"

// Models are declared once, used everywhere
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

### Step 2: Implement Infrastructure Adapters

```typescript
// src/infra-adapters/direct-api.ts
import { createDirectAPIAdapter } from "./direct-api"

const directAPI = createDirectAPIAdapter(
  process.env.ANTHROPIC_API_KEY,
  process.env.OPENAI_API_KEY,
  process.env.OPENROUTER_API_KEY
)

// src/infra-adapters/val-town.ts
import { createValTownAdapter } from "./val-town"

const valTown = createValTownAdapter({
  endpointUrl: process.env.VAL_TOWN_ENDPOINT,
  apiKey: process.env.VAL_TOWN_API_KEY
})
```

### Step 3: Configure Deployment

```typescript
// src/deployments.ts (based on environment)
export const DevelopmentConfig = {
  routes: [
    { model: "*", infra: "direct-api", priority: 0 }
  ]
}

export const ProductionConfig = {
  routes: [
    { model: "*", infra: "val-town", priority: 10 },      // Primary
    { model: "*", infra: "direct-api", priority: 0 }      // Fallback
  ]
}
```

### Step 4: Use in Server

```typescript
// src/server.ts (simplified)
const selectAndStream = (modelName: string) =>
  Effect.gen(function* () {
    const router = yield* InfraAdapterRouter
    const adapter = yield* router.getAdapter(modelName)
    return yield* adapter.streamChat(params)
  })
```

## Migration Checklist

### Phase 1: Add New System (No Changes to Existing)
- [ ] Create `src/infra-adapters/` directory
- [ ] Create `DirectAPIAdapter` wrapping existing SDK calls
- [ ] Create `src/model-registry.ts` with current models
- [ ] Create `src/deployments.ts` with routing rules
- [ ] Create `InfraAdapterRouter` service
- [ ] Create tests for new components

### Phase 2: Update Server (Old Adapters Still Work)
- [ ] Add `InfraAdapterRouter` to server
- [ ] Update privacy routing to use new router
- [ ] Keep old adapters as fallback
- [ ] Run existing tests (should still pass)

### Phase 3: Add Val.town Support
- [ ] Create `ValTownAdapter`
- [ ] Add Val.town configuration
- [ ] Update `ProductionConfig` to use Val.town
- [ ] Test routing changes

### Phase 4: Clean Up (Optional)
- [ ] Remove old monolithic adapters
- [ ] Remove old privacy routing logic
- [ ] Simplify server code

## Example: Adding Val.town in Production

### Current Setup (Before)
```typescript
// index.ts
const adapters = Layer.mergeAll(
  KeyServiceLive,
  RateLimiterLive,
  AnthropicAdapterLive(process.env.ANTHROPIC_API_KEY),
  OpenAIAdapterLive(process.env.OPENAI_API_KEY),
  OpenRouterAdapterLive(process.env.OPENROUTER_API_KEY)
)

// server.ts - Privacy-based routing hard-coded
if (privacy > 0.8) useAnthropicAdapter(params)
else if (privacy > 0.5) useOpenAIAdapter(params)
else useOpenRouterAdapter(params)
```

### New Setup (After)
```typescript
// index.ts
const infraAdapters = new Map([
  ["direct-api", directAPI],
  ["val-town", valTown]
])

const adapters = Layer.mergeAll(
  KeyServiceLive,
  RateLimiterLive,
  InfraAdapterRouterLive(infraAdapters),
  DeploymentFromEnv  // Production → uses Val.town
)

// server.ts - Model-based routing
const adapter = yield* router.getAdapter(modelName)
return yield* adapter.streamChat(params)
```

### Deploy to Production
```bash
# Just change environment variable
DEPLOYMENT=production node index.ts

# Automatically:
# • Routes all models to Val.town (priority 10)
# • Falls back to DirectAPI if Val.town fails (priority 0)
# • All existing tests pass
# • No code changes needed
```

## Testing Strategy

### Old Way
```typescript
test("privacy 0.9 uses Anthropic", () => {
  // Privacy logic + adapter logic + SDK mocking = complex
  expect(privacyRouter.select(0.9)).toBe(AnthropicAdapter)
  expect(AnthropicAdapter.streamChat()).toReturn(stream)
})
```

### New Way
```typescript
test("model routing", () => {
  const adapter = router.getAdapter("claude-3.5-sonnet")
  expect(adapter.name).toBe("DirectAPI")
})

test("infra adapter: DirectAPI", () => {
  const stream = directAPI.streamChat(params)
  expect(stream).toStreamChunks()
})

test("infra adapter: ValTown", () => {
  const stream = valTown.streamChat(params)
  expect(stream).toStreamChunks()
})

// Each component tested independently, composed in integration tests
```

## Fallback Strategy

If adding Val.town breaks production, you have options:

### Option 1: Immediate Rollback (No Code Change)
```typescript
// Just change environment variable or routing config
DEPLOYMENT=development  # Falls back to DirectAPI
```

### Option 2: Gradual Rollout
```typescript
routes: [
  // Start with 10% traffic to Val.town
  { model: "*", infra: "val-town", priority: 10, percentage: 0.1 },
  { model: "*", infra: "direct-api", priority: 10, percentage: 0.9 }
]
```

### Option 3: Model-Specific Rollback
```typescript
routes: [
  // Val.town works fine for Claude
  { model: "claude-*", infra: "val-town", priority: 20 },
  // But direct for GPT while debugging
  { model: "gpt-*", infra: "direct-api", priority: 20 },
  // Rest to Val.town
  { model: "*", infra: "val-town", priority: 10 }
]
```

## Key Takeaways

✅ **Models** are registered once, used everywhere
✅ **Infrastructure** providers are independent implementations
✅ **Routing** is configuration, not code logic
✅ **Testing** is simpler with separated concerns
✅ **Deployment** changes don't require code changes
