import type { ChatCompletionMessageParam } from "openai/resources"

// Shared request type (OpenAI-compatible)
export interface StreamChatParams {
  readonly model: string
  readonly messages: ChatCompletionMessageParam[]
  readonly privacy?: number // [0, 1] — 0.8 is baseline
}

// Shared normalized output — each adapter converts to this
export interface StreamChunk {
  readonly text: string
  readonly done: boolean
  readonly usage?: {
    readonly inputTokens: number
    readonly outputTokens: number
  }
}

// Validation errors
export class ValidationError extends Error {
  readonly field: string
  readonly constraint: string

  constructor(field: string, constraint: string, message: string) {
    super(message)
    this.name = "ValidationError"
    this.field = field
    this.constraint = constraint
  }
}
