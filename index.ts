import { Layer, Context, Effect } from "effect"
import { AnthropicAdapterLive } from "./src/adapters/anthropic"
import { OpenAIAdapterLive } from "./src/adapters/openai"
import { OpenRouterAdapterLive } from "./src/adapters/openrouter"
import { DeploymentFromEnv } from "./src/deployments"
import { KeyServiceLive } from "./src/keys"
import { RateLimiterLive } from "./src/rate-limit"
import { LedgerServiceLive } from "./src/ledger"
import { startServer } from "./src/server"
import { createValTownAdapter } from "./src/infra-adapters/val-town"

// Val.town adapter service
class ValTownAdapterService extends Context.Service<ValTownAdapterService, ReturnType<typeof createValTownAdapter>>()(
  "ValTownAdapterService"
) {}

const ValTownAdapterLive = Layer.succeed(
  ValTownAdapterService,
  createValTownAdapter({
    endpointUrl: process.env.VAL_TOWN_ENDPOINT || "https://cricks_unmixed4u--4b6470dc592f11f19884ee650bb23af1.web.val.run",
  })
)

const adapters = Layer.mergeAll(
  DeploymentFromEnv,
  KeyServiceLive,
  RateLimiterLive,
  LedgerServiceLive,
  AnthropicAdapterLive(process.env.ANTHROPIC_API_KEY ?? ""),
  OpenAIAdapterLive(process.env.OPENAI_API_KEY ?? ""),
  OpenRouterAdapterLive(process.env.OPENROUTER_API_KEY ?? ""),
  ValTownAdapterLive
)

const server = startServer(adapters, 3000)
console.log(`Farmer listening on http://localhost:${server.port}`)
