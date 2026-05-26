/**
 * Infrastructure Adapters Index
 * Exports all available infra providers that can be plugged into the system.
 *
 * Adding a new infrastructure provider:
 * 1. Create a new file (e.g., lambda.ts) implementing InfraAdapter
 * 2. Export it here
 * 3. Register it in the deployment config
 * No changes needed to core routing logic
 */

export type { InfraAdapter } from "./base"
export { InfraAdapterError } from "./base"

export { DirectAPIAdapterService, DirectAPIAdapterLive, DirectAPIError } from "./direct-api"
export { createValTownAdapter, ValTownError } from "./val-town"

export { InfraAdapterRouter, InfraAdapterRouterLive, createInfraAdapterRouter } from "./router"
export type { InfraProviderRoute, InfraProviderName } from "./router"
