import { Effect } from "effect"
import type { ChatCompletionMessageParam } from "openai/resources"
import { ValidationError } from "./types"
import type { StreamChatParams } from "./types"

const isMessage = (msg: unknown): msg is ChatCompletionMessageParam => {
  if (typeof msg !== "object" || msg === null) return false
  const m = msg as Record<string, unknown>
  return typeof m.role === "string" && typeof m.content === "string"
}

const isMessageArray = (msgs: unknown): msgs is ChatCompletionMessageParam[] => {
  if (!Array.isArray(msgs)) return false
  if (msgs.length === 0) return false
  return msgs.every(isMessage)
}

export const validateStreamChatParams = (body: unknown): Effect.Effect<StreamChatParams, ValidationError> =>
  Effect.gen(function* () {
    if (typeof body !== "object" || body === null) {
      return yield* Effect.fail(
        new ValidationError("body", "type", "Request body must be a JSON object")
      )
    }

    const obj = body as Record<string, unknown>

    // Validate model
    if (typeof obj.model !== "string") {
      return yield* Effect.fail(
        new ValidationError("model", "required", "model must be a non-empty string")
      )
    }
    if (obj.model.trim() === "") {
      return yield* Effect.fail(
        new ValidationError("model", "required", "model cannot be empty")
      )
    }

    // Validate messages
    if (!isMessageArray(obj.messages)) {
      return yield* Effect.fail(
        new ValidationError(
          "messages",
          "format",
          "messages must be a non-empty array of {role, content} objects"
        )
      )
    }

    return {
      model: obj.model,
      messages: obj.messages,
    } as StreamChatParams
  })
