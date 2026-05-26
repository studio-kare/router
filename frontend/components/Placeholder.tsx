import React, { useEffect, useState } from "react"

export function Placeholder() {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch("/v1/placeholder")
        if (res.ok) {
          const text = await res.text()
          setHtml(text)
        } else {
          setHtml("<h1>Farmer</h1><p>Try it now</p>")
        }
      } catch {
        setHtml("<h1>Farmer</h1><p>Try it now</p>")
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [])

  if (loading) {
    return (
      <div className="placeholder">
        <h1>Farmer</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div
      className="placeholder"
      dangerouslySetInnerHTML={{ __html: html || "<h1>Farmer</h1><p>Try it now</p>" }}
    />
  )
}
