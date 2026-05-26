import { Effect } from "effect"

// Simple logging functions called directly from effects
export const logInfo = (msg: string, data?: Record<string, unknown>) =>
  Effect.sync(() => {
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` ${JSON.stringify(data)}` : ""
    console.log(`[${timestamp}] INFO: ${msg}${dataStr}`)
  })

export const logError = (msg: string, data?: Record<string, unknown>) =>
  Effect.sync(() => {
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` ${JSON.stringify(data)}` : ""
    console.error(`[${timestamp}] ERROR: ${msg}${dataStr}`)
  })
