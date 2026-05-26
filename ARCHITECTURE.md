# Farmer Architecture: Decoupled Model + Infrastructure Providers

## Problem

The original architecture tightly coupled model providers (Anthropic, OpenAI) with infrastructure (direct API calls):

```
❌ Monolithic Adapters
┌──────────────────────────────────────┐
│ AnthropicAdapter                     │
│  • Knows about Anthropic SDK         │
│  • Makes direct API calls            │
│  • Can't switch to Val.town easily   │
└──────────────────────────────────────┘
```

This made it impossible to:
- Route a model to different infrastructure providers
- Deploy to Val.town without rewriting adapters
- Support new infrastructure without creating new adapters

## Solution: Open-Closed Architecture

Separate concerns into three independent, composable layers:

### Layer 1: Model Registry (Closed for Modification)

Maps model names to their origin provider:

```typescript
"claude-3.5-sonnet" → { provider: "anthropic", maxTokens: 200000 }
"gpt-4o"            → { provider: "openai", maxTokens: 128000 }
```

**Adding a new model is trivial** - just add to the registry. No code changes.

```typescript
registerModel({
  name: "claude-4",
  provider: "anthropic",
  maxTokens: 400000
})
```

### Layer 2: Infrastructure Adapters (Open for Extension)

Each infra provider implements a simple, generic interface:

```typescript
interface InfraAdapter {
  readonly name: string
  readonly streamChat: (params: StreamChatParams) 
    => Effect.Effect<Stream.Stream<StreamChunk, Error>, Error>
}
```

Implementations:

#### DirectAPI Adapter
- Calls Anthropic, OpenAI, OpenRouter SDKs directly
- Uses model registry to determine which SDK to use
- Current production behavior

#### Val.town Adapter
- Proxies requests to a Val.town HTTP endpoint
- Endpoint handles model-specific logic
- Cost-optimized for production
- **No code changes needed to add support for new models**

#### Future: Lambda, Local, etc.
- Just implement the interface
- Register in deployment config
- Works with any model

### Layer 3: Infrastructure Router (Configuration)

Maps models to infrastructure adapters based on deployment:

```typescript
// Development: Direct API for everything
{
  model: "*",
  infra: "direct-api",
  priority: 0
}

// Production: Val.town first (cost), DirectAPI fallback
[
  { model: "*", infra: "val-town", priority: 10 },
  { model: "*", infra: "direct-api", priority: 0 }
]
```

**No code changes** - just change configuration.

## Data Flow

```
HTTP Request
  ↓
Model Registry: "gpt-4o" → "openai"
  ↓
Infrastructure Router: Get adapter for this model
  ↓
DirectAPIAdapter (or ValTownAdapter, etc.)
  ↓
SDK Call (Anthropic/OpenAI) or HTTP Proxy (Val.town)
  ↓
Stream Chunks + Usage
  ↓
Rate Limiting + Token Tracking
  ↓
HTTP Response (SSE)
```

## Key Benefits

### ✅ Open-Closed Principle
- **Closed for modification**: Don't touch routing logic to add new models or infra
- **Open for extension**: New models just get registered, new infra providers just implement interface

### ✅ Independence
- Model registry changes don't affect adapters
- Adding Val.town support doesn't affect model registry
- Deployment routing changes don't affect either

### ✅ Testability
- Mock adapters for testing
- Test routing separately from implementation
- Each layer can be tested in isolation

### ✅ Flexibility
- Same model can use different infra in different deployments
- Easy A/B testing (route 10% to Val.town, 90% to DirectAPI)
- Easy failover (if Val.town fails, try DirectAPI)

## Adding a New Infrastructure Provider

### Step 1: Implement the Adapter

```typescript
// src/infra-adapters/my-provider.ts
export const createMyProviderAdapter = (config): InfraAdapter => ({
  name: "MyProvider",
  streamChat: (params) => {
    // Your implementation here
  }
})
```

### Step 2: Register It

```typescript
// src/index.ts
const adapters = new Map([
  ["direct-api", directAPIAdapter],
  ["my-provider", myProviderAdapter],
  ["val-town", valTownAdapter]
])
```

### Step 3: Configure Routing

```typescript
// src/deployments.ts
export const ProductionConfig: DeploymentConfig = {
  routes: [
    { model: "*", infra: "my-provider", priority: 10 }
  ]
}
```

**That's it.** No changes to core routing logic, model registry, or any other adapters.

## Example: Adding Val.town Support

### Without Decoupling (Old Way)
- ❌ Create ValTownAdapterService
- ❌ Create AnthropicViaValTownAdapter
- ❌ Create OpenAIViaValTownAdapter
- ❌ Create OpenRouterViaValTownAdapter
- ❌ Update privacy routing logic
- ❌ Update server to handle new adapters

### With Decoupling (New Way)
- ✅ Create ValTownAdapter (generic, model-agnostic)
- ✅ Update DeploymentConfig to route to it
- **Done.** All models automatically route through Val.town.

## Deployment Scenarios

### Scenario 1: Local Development
```typescript
DevelopmentConfig = {
  routes: [{ model: "*", infra: "direct-api" }]
}
```
- All requests go direct to providers
- Full control, instant iteration

### Scenario 2: Cost-Optimized Production
```typescript
ProductionConfig = {
  routes: [
    { model: "*", infra: "val-town", priority: 10 },   // Primary: ValTown (cheaper)
    { model: "*", infra: "direct-api", priority: 0 }   // Fallback: DirectAPI
  ]
}
```
- Val.town handles most traffic (cost arbitrage)
- Automatic fallback on failure

### Scenario 3: Model-Specific Routing
```typescript
routes: [
  // Claude on Val.town for cost
  { model: "claude-*", infra: "val-town", priority: 20 },
  // GPT direct (lower latency needs)
  { model: "gpt-*", infra: "direct-api", priority: 20 },
  // Everything else via Val.town
  { model: "*", infra: "val-town", priority: 10 }
]
```

## Testing

Each layer can be tested independently:

```typescript
// Test model registry
getModelProvider("gpt-4o") === "openai" ✓

// Test routing logic
router.getAdapter("claude-3.5-sonnet") → DirectAPIAdapter ✓

// Test adapters with mocks
mockValTownAdapter.streamChat(...) → Stream ✓
```

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Add model | Edit adapter code | Register in registry |
| Add infra provider | Create 3+ adapters | Create 1 adapter |
| Change deployment | Update routing logic | Change config |
| Test isolation | Hard | Easy |
| Code duplication | High (3 OpenAI adapters) | None |
