import type { ChatCompletionMessageParam } from "openai/resources"

// Shared request type (OpenAI-compatible)
export interface StreamChatParams {
  readonly model: string
  readonly messages: ChatCompletionMessageParam[]
}

// Shared normalized output — each adapter converts to this
export interface StreamChunk {
  readonly text: string
  readonly done: boolean
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
