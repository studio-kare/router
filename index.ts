import { Layer } from "effect"
import { AnthropicAdapterLive } from "./src/adapters/anthropic"
import { OpenAIAdapterLive } from "./src/adapters/openai"
import { OpenRouterAdapterLive } from "./src/adapters/openrouter"
import { DevelopmentLive } from "./src/deployment"
import { startServer } from "./src/server"

const adapters = Layer.mergeAll(
  DevelopmentLive,
  AnthropicAdapterLive(process.env.ANTHROPIC_API_KEY ?? ""),
  OpenAIAdapterLive(process.env.OPENAI_API_KEY ?? ""),
  OpenRouterAdapterLive(process.env.OPENROUTER_API_KEY ?? "")
)

const server = startServer(adapters, 3000)
console.log(`Farmer listening on http://localhost:${server.port}`)
