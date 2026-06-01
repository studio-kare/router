import React, { useEffect, useState } from "react"

interface WebhookEvent {
  id: string
  repo: string
  event_type: string
  action: string
  issue_number: number
  issue_title: string
  comment_body: string | null
  author: string
  url: string
  created_at: number
}

interface WatchedRepo {
  repo_full_name: string
  created_at: number
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function badgeClass(action: string): string {
  if (action === "opened") return "event-badge opened"
  if (action === "closed") return "event-badge closed"
  if (action === "reopened") return "event-badge opened"
  return "event-badge commented"
}

export function EventLog() {
  const [repos, setRepos] = useState<WatchedRepo[]>([])
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [setting, setSetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRepos = () =>
    fetch("/v1/webhooks/repos")
      .then((r) => r.ok ? r.json() : [])
      .then(setRepos)
      .catch(() => {})

  const fetchEvents = () =>
    fetch("/v1/webhook-events?limit=50")
      .then((r) => r.ok ? r.json() : [])
      .then(setEvents)
      .catch(() => {})

  useEffect(() => {
    Promise.all([fetchRepos(), fetchEvents()]).finally(() => setLoading(false))
    const interval = setInterval(fetchEvents, 10000)
    return () => clearInterval(interval)
  }, [])

  const setupRepo = async (repo: string) => {
    setSetting(true)
    setError(null)
    try {
      const res = await fetch("/v1/webhooks/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.reauth) {
          window.location.href = "/auth/github"
          return
        }
        setError(data.error || "Failed to set up webhook")
      } else {
        await fetchRepos()
      }
    } catch {
      setError("Network error")
    } finally {
      setSetting(false)
    }
  }

  if (loading) return <div className="event-log"><p className="event-loading">Loading...</p></div>

  const isWatching = repos.some((r) => r.repo_full_name === "studio-kare/router")

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h2>Event Log</h2>
        {isWatching && <span className="watching-badge">Watching</span>}
      </div>

      {!isWatching && (
        <div className="setup-prompt">
          <p>Watch issues and comments on a repository.</p>
          <button
            className="setup-btn"
            onClick={() => setupRepo("studio-kare/router")}
            disabled={setting}
          >
            {setting ? "Setting up..." : "Start watching studio-kare/router"}
          </button>
          {error && <p className="setup-error">{error}</p>}
        </div>
      )}

      {isWatching && events.length === 0 && (
        <p className="event-empty">No events yet. Activity will appear here when issues or comments are created.</p>
      )}

      {events.map((event) => (
        <a
          key={event.id}
          className="event-card"
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="event-card-header">
            <span className={badgeClass(event.action)}>{event.action}</span>
            <span className="event-time">{timeAgo(event.created_at)}</span>
          </div>
          <div className="event-title">
            #{event.issue_number} {event.issue_title}
          </div>
          {event.comment_body && (
            <div className="event-comment">{event.comment_body}</div>
          )}
          <div className="event-meta">
            <span className="event-author">{event.author}</span>
            <span className="event-repo">{event.repo}</span>
          </div>
        </a>
      ))}
    </div>
  )
}
