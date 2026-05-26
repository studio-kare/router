# Effect Guidelines

Derived from Effect TS office hours code review (SvelteKit runtime adapter).

## Layer construction

**Hold a global `MemoMap`, not a global `Layer`.**
Pass it to `ManagedRuntime.make(layer, { memoMap })`. The `MemoMap` caches services during layer traversal — already-constructed services are returned immediately without rebuilding. No manual mutex or locking needed.

**Compose the full layer graph at startup, provide it once.**
Don't build or provide layers dynamically inside running effects. Use `Effect.provideService` or `Effect.provideContext` for runtime-variant instances if needed.

**`ManagedRuntime` already caches** — audit before adding manual singleton logic.

**`LayerMap` is the right tool only when multiple instances of the same service are genuinely needed.**

## Runtime typing

**Type the runtime — don't use `unknown` for service requirements.**
`unknown` silently bypasses the guarantee that requirements are provided. Use a typed instantiation:

```typescript
export const { runWithRuntime } = makeGlobalRuntime(appLayer)
```

Types can be inferred from the layer.

## Error handling

**Handle errors at the runtime boundary** — if an error leaks to `catch`, there's no recovery path. Options:
- Accept an `onError` handler
- Return `Promise<Exit<A, E>>` for callers to inspect
- Require effects to handle their own errors before reaching the runtime

## API design

**Lean into Effect — don't mix `Effect | Promise | A`.**
If the library accepts effects, accept effects. Runtime `instanceof` checks to disambiguate a union type is a sign of too much mixing. If sync/async support is needed, use separate methods with distinct names.

## Mental models

```
layers + MemoMap = context
```

- `Layer.fresh` opts a subtree out of the `MemoMap` — forces rebuild even if cached
- `Effect.provideService` / `Effect.provideContext` update the `Context` directly; unrelated to `MemoMap`
- `Effect.serviceOption` lets a service be optionally present — useful for "use the transaction connection if one exists, otherwise use the regular client" patterns
