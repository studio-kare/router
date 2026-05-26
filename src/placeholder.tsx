import React from "react"
import { renderToString } from "react-dom/server"

export const getPlaceholderHtml = (deploymentName: string): string => {
  const element =
    deploymentName === "production" ? (
      <>
        <h1>Farmer</h1>
        <p>Routing through Val.town</p >
      </>
    ) : deploymentName === "staging" ? (
      <>
        <h1>Farmer</h1>
        <p>Staging environment</p>
      </>
    ) : (
      <>
        <h1>Farmer</h1>
        <p>Try it no</p>
      </>
    )

  return renderToString(element)
}
