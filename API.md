# Farmer API Documentation

Farmer is an LLM router that intelligently routes requests across multiple providers (Anthropic, OpenAI, OpenRouter) based on privacy requirements and cost optimization.

## Base URL

```
http://localhost:3000  # Development
https://api.farmer.example.com  # Production
```

## Authentication

All requests to protected endpoints must include a Bearer token:

```bash
Authorization: Bearer sk_your_api_key_here
```

Get your API key from the API key management endpoints or the dashboard.

## Rate Limiting

Farmer implements three-tier rate limiting per API key:

### Fairness Limit
- **100 requests/second** sustained
- Allows bursts up to 10 seconds worth of capacity
- Ensures fair resource sharing

### Abuse Limit
- **1000 requests/second** hard ceiling
- Breach triggers 5-minute cooldown
- Protects infrastructure

### Budget Limit
- **1,000,000 tokens/day**
- Cumulative LLM token tracking
- Soft enforcement (warns at 80%, blocks at 100%)

### Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Panic: false                    # true when >80% of any limit
X-RateLimit-Fairness-Remaining: 95         # Tokens left for fairness bucket
X-RateLimit-Fairness-Reset: 1779817888669  # Unix ms when bucket refills
X-RateLimit-Budget-Used: 2500              # Tokens used today
X-RateLimit-Budget-Remaining: 997500       # Tokens left today
X-RateLimit-Budget-Reset: 1779904288658    # Unix ms when daily quota resets
Retry-After: 45                            # Seconds to wait if rate limited (429)
```

When rate limited (HTTP 429):
```json
{
  "error": "Rate limit exceeded",
  "quota": {
    "fairness": { "remaining": 0, "resetAt": 1779817888669 },
    "abuse": { "blocked": true, "blockedUntil": 1779818188669 },
    "budget": { "used": 1000000, "remaining": 0, "resetAt": 1779904288658 },
    "panic": true
  }
}
```

---

## Endpoints

### Chat Completions (Streaming)

Routes LLM requests to the best provider based on privacy level.

**Endpoint:**
```
POST /v1/chat/completions
```

**Authentication:** Required (Bearer token)

**Request Headers:**
```
Authorization: Bearer sk_your_api_key_here
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "What is machine learning?"
    }
  ],
  "privacy": 0.8
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model identifier (e.g., `gpt-4`, `claude-3-sonnet`, `meta-llama/llama-3.1-8b-instruct`) |
| `messages` | array | Yes | Chat message history. Each message has `role` ("user", "assistant", "system") and `content` (string) |
| `privacy` | number | No | Privacy level 0-1 (default: 0.8). Higher = more private = more expensive provider. See [Privacy Levels](#privacy-levels) |

**Response:**

Server-Sent Events (SSE) stream with chat completion chunks:

```
data: {"id":"farmer-1779817840123","object":"chat.completion.chunk","created":1779817840,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Machine"},"finish_reason":null,"logprobs":null}]}

data: {"id":"farmer-1779817840123","object":"chat.completion.chunk","created":1779817840,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" learning"},"finish_reason":null,"logprobs":null}]}

data: [DONE]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success, streaming response begins |
| 400 | Invalid request (missing required fields, malformed messages) |
| 401 | Missing or invalid API key |
| 429 | Rate limit exceeded (fairness, abuse, or budget) |
| 500 | Server error or upstream provider error |

**Example - curl:**

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "privacy": 0.8
  }'
```

**Example - Python:**

```python
import requests
import json

url = "http://localhost:3000/v1/chat/completions"
headers = {
    "Authorization": "Bearer sk_your_api_key_here",
    "Content-Type": "application/json"
}
payload = {
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "privacy": 0.8
}

response = requests.post(url, headers=headers, json=payload, stream=True)

for line in response.iter_lines():
    if line:
        if line.startswith(b'data: '):
            data = line[6:]
            if data != b'[DONE]':
                chunk = json.loads(data)
                content = chunk['choices'][0]['delta'].get('content', '')
                print(content, end='', flush=True)
```

**Example - Node.js:**

```javascript
const fetch = require('node-fetch');

async function chat(prompt, privacy = 0.8) {
  const response = await fetch('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_your_api_key_here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      privacy
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const data = JSON.parse(line.slice(6));
        const content = data.choices[0].delta?.content || '';
        process.stdout.write(content);
      }
    }
  }
}

chat('What is quantum computing?');
```

---

### Get Quota

Check your rate limit and budget status.

**Endpoint:**
```
GET /v1/quota
```

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "fairness": {
    "remaining": 95,
    "resetAt": 1779817888669
  },
  "abuse": {
    "blocked": false,
    "blockedUntil": null
  },
  "budget": {
    "used": 2500,
    "remaining": 997500,
    "resetAt": 1779904288658
  },
  "panic": false
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `fairness.remaining` | number | Request tokens available (refills continuously) |
| `fairness.resetAt` | number | Unix timestamp (ms) of next refill |
| `abuse.blocked` | boolean | Whether abuse limit cooldown is active |
| `abuse.blockedUntil` | number \| null | Unix timestamp (ms) when block expires, or null if not blocked |
| `budget.used` | number | LLM tokens consumed today |
| `budget.remaining` | number | LLM tokens left in daily quota |
| `budget.resetAt` | number | Unix timestamp (ms) when daily quota resets (24h from creation) |
| `panic` | boolean | true if any limit is >80% used (fairness <20 remaining, budget >800k used, or blocked) |

**Example - curl:**

```bash
curl http://localhost:3000/v1/quota \
  -H "Authorization: Bearer sk_your_api_key_here"
```

---

### API Key Management

#### Generate API Key

**Endpoint:**
```
POST /v1/keys/generate
```

**Authentication:** Not required (for initial setup)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "sk_7Apg7BaVVxJAVsXLijMjdXJVIiwAkbE1",
  "createdAt": 1779817840123,
  "lastUsed": null,
  "revokedAt": null
}
```

**Important:** Store the `key` value securely. You won't be able to retrieve it later.

**Example:**

```bash
curl -X POST http://localhost:3000/v1/keys/generate
```

---

#### List API Keys

**Endpoint:**
```
GET /v1/keys
```

**Authentication:** Not required

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "sk_7Apg...kbE1",
    "createdAt": 1779817840123,
    "lastUsed": 1779817900000,
    "revokedAt": null
  }
]
```

**Note:** API keys are masked (`sk_7Apg...kbE1`) in list responses for security.

**Example:**

```bash
curl http://localhost:3000/v1/keys
```

---

#### Revoke API Key

**Endpoint:**
```
POST /v1/keys/revoke
```

**Authentication:** Not required

**Request Body:**
```json
{
  "key": "sk_7Apg7BaVVxJAVsXLijMjdXJVIiwAkbE1"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/v1/keys/revoke \
  -H "Content-Type: application/json" \
  -d '{"key": "sk_your_api_key_here"}'
```

---

### Deployment Info

Get information about the current deployment environment.

**Endpoint:**
```
GET /v1/deployment
```

**Authentication:** Not required

**Response:**
```json
{
  "name": "development",
  "apiUrl": "http://localhost:3000",
  "features": {
    "experimentalAdapters": true,
    "privacyModes": true
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Deployment environment: "development", "staging", or "production" |
| `apiUrl` | string | Base URL for this deployment |
| `features.experimentalAdapters` | boolean | Whether experimental LLM providers are enabled |
| `features.privacyModes` | boolean | Whether privacy-based routing is enabled |

**Example:**

```bash
curl http://localhost:3000/v1/deployment
```

---

### Privacy Routing Info

Get adapter routing probabilities for a given privacy level.

**Endpoint:**
```
GET /v1/privacy/info?privacy=0.8
```

**Authentication:** Not required

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `privacy` | number | 0.8 | Privacy level 0-1. Must be a valid number between 0 and 1 |

**Response:**
```json
{
  "privacy": 0.8,
  "routing": {
    "anthropic": {
      "probability": 1.0,
      "costMultiplier": 2.42
    },
    "openai": {
      "probability": 0.0,
      "costMultiplier": 2.42
    },
    "openrouter": {
      "probability": 0.0,
      "costMultiplier": 2.42
    }
  }
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `privacy` | number | Echo of the requested privacy level |
| `routing.*.probability` | number | 0-1, probability of routing to this provider |
| `routing.*.costMultiplier` | number | Multiplier applied to base provider costs at this privacy level |

**Privacy Levels:**

- **0.0-0.3 (Public):** Routes to cheapest provider (OpenRouter), suitable for non-sensitive queries
- **0.3-0.6 (Balanced):** Mix of cost and privacy, routes to OpenAI or OpenRouter
- **0.6-0.85 (Private):** Prefers privacy-focused providers, may route to Anthropic
- **0.85-1.0 (Maximum):** Routes to most privacy-conscious provider (Anthropic), highest cost

**Example:**

```bash
# Public data - route to cheapest
curl 'http://localhost:3000/v1/privacy/info?privacy=0.2'

# Balanced
curl 'http://localhost:3000/v1/privacy/info?privacy=0.5'

# Private data - route to most secure
curl 'http://localhost:3000/v1/privacy/info?privacy=0.9'
```

---

### Health Check

**Endpoint:**
```
GET /health
```

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok"
}
```

**Example:**

```bash
curl http://localhost:3000/health
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "field": "field_name",
  "constraint": "constraint_type"
}
```

### Common Errors

**Missing Authorization:**
```
HTTP 401
{
  "error": "Missing or invalid authorization header"
}
```

**Invalid API Key:**
```
HTTP 401
{
  "error": "Invalid API key"
}
```

**Rate Limited (Fairness):**
```
HTTP 429
{
  "error": "Rate limit exceeded",
  "quota": { ... }
}
Retry-After: 2
```

**Rate Limited (Abuse - Cooldown):**
```
HTTP 429
{
  "error": "Rate limit exceeded",
  "quota": { ... }
}
Retry-After: 300
```

**Budget Exceeded:**
```
HTTP 429
{
  "error": "Rate limit exceeded",
  "quota": { "budget": { "remaining": 0 }, ... }
}
```

**Invalid Request:**
```
HTTP 400
{
  "error": "Field 'model' is required",
  "field": "model",
  "constraint": "required"
}
```

---

## Privacy Levels Explained

The `privacy` parameter (0-1) controls which LLM provider handles your request:

- **Low privacy (0.0):** Uses cheapest provider, suitable for public data
- **High privacy (1.0):** Uses most privacy-conscious provider, highest cost
- **Default (0.8):** Balanced approach - routes to privacy-focused providers for most requests

**Use cases:**

```javascript
// Public query - lowest cost
await chat("What's the weather in NYC?", 0.2)

// Balanced - default
await chat("How do I implement OAuth?", 0.8)

// Sensitive data - highest privacy
await chat("Encrypt this API key: ...", 0.95)
```

Farmer's cost arbitrage model means you can set `privacy=0.8` by default and still benefit from cost optimization for non-sensitive queries.

---

## Quickstart

### 1. Generate an API Key

```bash
curl -X POST http://localhost:3000/v1/keys/generate
# Returns: {"key": "sk_...", ...}
```

### 2. Make Your First Request

```bash
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "privacy": 0.8
  }'
```

### 3. Check Your Quota

```bash
curl http://localhost:3000/v1/quota \
  -H "Authorization: Bearer sk_your_key_here"
```

---

## Rate Limit Strategy

**Understand the three limits:**

1. **Fairness (100 req/sec):** You can send 100 requests/second continuously. Exceeding this is unusual and gets rate limited.

2. **Abuse (1000 req/sec):** Bursts above 1000 req/sec trigger a 5-minute cooldown. If you hit this, something is wrong (infinite loop, test suite running concurrently, etc.).

3. **Budget (1M tokens/day):** Your daily quota. Budget resets every 24 hours from key creation.

**Recommended approach:**

```javascript
// Check quota before making requests
const quota = await checkQuota();

if (quota.panic) {
  console.warn('Approaching rate limits');
}

if (quota.budget.remaining < 50000) {
  console.warn(`Only ${quota.budget.remaining} tokens left today`);
}

// Make request if healthy
if (!quota.abuse.blocked && quota.budget.remaining > 0) {
  const response = await chat(prompt);
}
```

---

## Monitoring & Debugging

**Response headers contain all the information you need:**

```bash
curl -i -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "test"}]}'
```

Look for:
- `X-RateLimit-Panic` - Warning indicator
- `X-RateLimit-Budget-Remaining` - Daily token budget status
- `Retry-After` - If rate limited, how long to wait

**Check quota details:**

```bash
curl http://localhost:3000/v1/quota \
  -H "Authorization: Bearer sk_your_key_here" \
  | jq '.budget'
```

---

## Support

For issues or questions:
- Check the [Privacy Levels](#privacy-levels-explained) section
- Review the [Rate Limit Strategy](#rate-limit-strategy) section
- Ensure your API key is valid and not revoked
- Check `X-RateLimit-Panic` header for limit warnings
