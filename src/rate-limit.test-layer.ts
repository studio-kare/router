import { RateLimiterLive } from "./rate-limit"

// Use the live in-memory rate limiter for tests
export const RateLimiterTest = RateLimiterLive
