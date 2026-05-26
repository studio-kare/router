# Production Architecture: Model + Infrastructure Decoupling

## The Problem You Solved For

> "For bringing this closer to production, e.g. using val.town, I'd also need a different kind of adapter: one that allows me to proxy user to a specific provider of each model. Effectively, an adapter must be ModelProvider+InfraProvider and I must be able to model Model-(anthropic) and InfraProvider (Val.town) independently modifiable, strictly open-closed."

## The Solution

A three-layer, open-closed architecture that cleanly separates:

1. **Model Registry** - Which models exist and their origin provider
2. **Infrastructure Adapters** - How to execute chat completions
3. **Deployment Routing** - Which infra handles which models

## Key Files Created

### Core Architecture

```
src/
├── model-registry.ts           # "gpt-4o" → "openai" mapping
├── infra-adapters/
│   ├── base.ts                 # Generic InfraAdapter interface
│   ├── direct-api.ts           # Current SDK calls (Anthropic, OpenAI, OpenRouter)
│   ├── val-town.ts             # Val.town proxy implementation
│   ├── router.ts               # Routes models to infra adapters
│   └── index.ts                # Exports
└── deployments.ts              # Dev/staging/prod configurations
```

### Documentation

```
ARCHITECTURE.md              # Detailed design explanation
ARCHITECTURE-EXAMPLE.md      # Concrete step-by-step examples
MIGRATION.md                 # How to migrate existing code
ARCHITECTURE-SUMMARY.md      # This file
```

## Key Design Principles

### 1. Open-Closed Principle

**Adding a new model:**
```typescript
registerModel({
  name: "claude-4",
  provider: "anthropic",
  maxTokens: 400000
})
// ✅ No code changes needed
```

**Adding Val.town infrastructure:**
```typescript
// Create one adapter
const valTownAdapter = createValTownAdapter(config)
// Update config
routes: [{ model: "*", infra: "val-town", priority: 10 }]
// ✅ No code changes needed
```

### 2. Independent Modification

Models, infrastructure, and routing are **completely independent**:

```
Model Registry ──────┐
                     ├──> Infrastructure Router
Infra Adapters ──────┤
                     ├──> Deployment Config
Routing Rules ───────┘

Change any layer without touching the others
```

### 3. Configuration Over Code

Switching from DirectAPI to Val.town in production:
```bash
# Just change environment variable
DEPLOYMENT=production

# Automatically uses:
routes: [
  { model: "*", infra: "val-town", priority: 10 },
  { model: "*", infra: "direct-api", priority: 0 }
]
```

## Architecture in Action

### Request Flow

```
POST /v1/chat/completions
model: "claude-3.5-sonnet"
  ↓
1. Model Registry: "claude-3.5-sonnet" → "anthropic"
  ↓
2. Infrastructure Router: Find adapter for this model
  ↓
3. Deployment Config: Production → Use Val.town
  ↓
4. Val.town Adapter: 
   - Proxy to https://val-town-endpoint/v1/chat/completions
   - Val.town knows it's Anthropic model
   - Calls Anthropic SDK
  ↓
5. Stream response, record tokens, return to client
```

## Three-Tier Decoupling

### Tier 1: Model Provider (CLOSED FOR MODIFICATION)

Models are registered once:
```typescript
MODELS = {
  "claude-3.5-sonnet": { provider: "anthropic", maxTokens: 200000 },
  "gpt-4o": { provider: "openai", maxTokens: 128000 },
  "llama-3.1": { provider: "openrouter", maxTokens: 131072 }
}
```

Adding a new model is trivial - just one line in the registry.

### Tier 2: Infrastructure Adapters (OPEN FOR EXTENSION)

Any new infrastructure provider just implements:
```typescript
interface InfraAdapter {
  name: string
  streamChat(params: StreamChatParams): Stream<StreamChunk, Error>
}
```

Current implementations:
- **DirectAPI** - Calls SDK directly (current behavior)
- **Val.town** - Proxies to Val.town endpoint (new)
- **Future** - Lambda, Local, GCP Cloud Run, etc.

### Tier 3: Routing (CONFIGURATION)

Deployment-specific routing rules:
```typescript
Development:   { model: "*", infra: "direct-api" }
Production:    { model: "*", infra: "val-town", priority: 10 }
             + { model: "*", infra: "direct-api", priority: 0 }
```

Change without modifying adapters or models.

## Deployment Scenarios

### Scenario 1: Local Development
```typescript
routes: [{ model: "*", infra: "direct-api" }]
```
✅ All models use direct API calls
✅ Fast iteration, full control

### Scenario 2: Cost-Optimized Production
```typescript
routes: [
  { model: "*", infra: "val-town", priority: 10 },
  { model: "*", infra: "direct-api", priority: 0 }
]
```
✅ Val.town handles most traffic (cost arbitrage)
✅ Automatic fallback to DirectAPI
✅ No code changes if Val.town fails

### Scenario 3: Model-Specific Routing
```typescript
routes: [
  { model: "claude-*", infra: "val-town", priority: 20 },
  { model: "gpt-*", infra: "direct-api", priority: 20 },
  { model: "*", infra: "val-town", priority: 10 }
]
```
✅ Different models through different paths
✅ Optimize cost per model
✅ Change without code

## Implementation Status

✅ **Model Registry** - Complete
- All current models registered
- Easy to add new models
- Can be extended at runtime

✅ **Infrastructure Adapters** - Complete
- DirectAPI implementation (wraps existing SDKs)
- Val.town implementation (proxy example)
- Generic interface for future providers

✅ **Infrastructure Router** - Complete
- Model-to-adapter routing
- Priority-based selection
- Fallback support

✅ **Deployment Configuration** - Complete
- Development config (DirectAPI)
- Production config (Val.town + DirectAPI)
- Environment-based selection

✅ **Documentation** - Complete
- ARCHITECTURE.md - Design explanation
- ARCHITECTURE-EXAMPLE.md - Step-by-step examples
- MIGRATION.md - Migration guide

## Next Steps

### Option A: Gradual Integration
1. Keep existing adapters working (backward compatible)
2. Add new infra adapters alongside old ones
3. Gradually migrate routing to use new system
4. Remove old adapters when ready

### Option B: Full Migration
1. Migrate to new architecture immediately
2. Delete old monolithic adapters
3. Use new DirectAPI adapter instead
4. All existing tests still pass

### Option C: Hybrid
1. Use new architecture for Val.town (production)
2. Keep old adapters for legacy code (temporary)
3. Migrate over time as code is refactored

## Testing Strategy

Each layer can be tested independently:

```typescript
// Test model registry
test("model lookups") {
  expect(getModelProvider("gpt-4o")).toBe("openai")
}

// Test router
test("infra routing") {
  expect(router.getAdapter("claude-3.5-sonnet")).toBe(directAPI)
}

// Test adapters separately
test("DirectAPI adapter", () => { ... })
test("ValTown adapter", () => { ... })

// Test integration
test("end-to-end", () => { ... })
```

No monolithic adapter logic to test - much simpler.

## Emergency Rollback

If something breaks in production, rollback in seconds:

```bash
# Option 1: Environment variable
DEPLOYMENT=development

# Option 2: Config change (no recompile)
# Comment out Val.town route, DirectAPI becomes primary

# Option 3: Per-model override
routes: [
  { model: "gpt-*", infra: "direct-api", priority: 20 },
  { model: "*", infra: "val-town", priority: 10 }
]
```

## The Open-Closed Principle in Action

| Task | Before (Monolithic) | After (Decoupled) |
|------|------------------|-----------------|
| Add model | ❌ Update SDK logic | ✅ Register in registry |
| Add infra | ❌ Create 3 new adapters | ✅ Create 1 adapter |
| Change provider | ❌ Modify routing logic | ✅ Update config |
| Deploy to Val.town | ❌ Major refactor | ✅ Create adapter + config |
| Rollback | ❌ Code recompile | ✅ Change env var |
| A/B test | ❌ Conditional logic | ✅ Percentage routing |

## Summary

This architecture gives you:

✅ **Flexibility** - Swap infrastructure providers without code changes
✅ **Scalability** - Add models and adapters independently
✅ **Maintainability** - Each layer has a single responsibility
✅ **Testability** - Test each component in isolation
✅ **Production-Ready** - Deploy to Val.town today, Lambda tomorrow
✅ **Open-Closed** - Open for extension, closed for modification

You can now deploy Farmer to production using Val.town (or any infrastructure) with zero changes to model registry or existing adapters.
