import { Effect, Stream } from "effect"
import type { StreamChatParams, StreamChunk } from "../types"

/**
 * Infrastructure Adapter interface
 * Implementations handle the actual execution of chat completions
 * regardless of which model provider or infra is used.
 *
 * This is open for extension: new infra providers (Val.town, Lambda, etc.)
 * just implement this interface.
 */
export interface InfraAdapter {
  readonly name: string
  readonly streamChat: (
    params: StreamChatParams
  ) => Effect.Effect<Stream.Stream<StreamChunk, Error>, Error>
}

/**
 * Abstract typed error for infrastructure adapters.
 * Subclasses should define specific error types.
 */
export abstract class InfraAdapterError extends Error {
  readonly abstract readonly type: string

  constructor(message: string) {
    super(message)
    this.name = this.type
  }
}
