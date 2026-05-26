import React from "react"
import { DeploymentSidebar } from "./DeploymentSidebar"
import { Placeholder } from "./Placeholder"

export function App() {
  return (
    <div className="container">
      <DeploymentSidebar />
      <main className="main-content">
        <Placeholder />
      </main>
    </div>
  )
}
