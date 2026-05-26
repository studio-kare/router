import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./frontend/components/App"
import { injectStyles } from "./frontend/styles"

// Inject styles
injectStyles()

// Render app
const root = createRoot(document.getElementById("root")!)
root.render(<App />)
