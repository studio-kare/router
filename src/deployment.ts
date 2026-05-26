import { Context, Layer } from "effect"

export class Deployment extends Context.Service<
  Deployment,
  {
    readonly name: "development" | "staging" | "production"
    readonly apiUrl: string
    readonly features: {
      readonly experimentalAdapters: boolean
      readonly privacyModes: boolean
    }
  }
>()("Deployment") {}

export const DevelopmentLive = Layer.succeed(Deployment)({
  name: "development",
  apiUrl: "http://localhost:3000",
  features: {
    experimentalAdapters: true,
    privacyModes: true,
  },
})
