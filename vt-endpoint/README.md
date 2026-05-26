# Farmer Val.town Endpoint

This is a Val.town-deployable endpoint that handles LLM chat completions.

**Usage:**
- Deploy this to your Val.town account
- Get your endpoint URL
- Use it in Farmer as infrastructure provider

## Architecture

This endpoint is **model-agnostic**:
- Receives request with model name
- Looks up model provider (Anthropic, OpenAI, OpenRouter)
- Calls the appropriate provider SDK
- Returns streamed response

## Features

✅ Streaming chat completions (Server-Sent Events)
✅ Multiple provider support (Anthropic, OpenAI, OpenRouter)
✅ Token tracking and usage reporting
✅ Rate limiting aware
✅ Error handling with fallback

## Configuration

Set these environment variables on your Val.town account:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=...
```

## Deployment

1. Copy `main.ts` to a new Val.town HTTP val
2. Set environment variables above
3. Get your endpoint URL: `https://yourname-farmer-endpoint.web.val.run`

## Usage

```bash
curl -X POST https://yourname-farmer-endpoint.web.val.run/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## For Users (Ejection Path)

Want to self-host? 
1. Fork this endpoint to your Val.town
2. Set your own API keys
3. Replace the endpoint URL in Farmer
4. Now all your traffic goes through your account

## Integration with Farmer

In Farmer, configure:

```typescript
const valTownAdapter = createValTownAdapter({
  endpointUrl: "https://yourname-farmer-endpoint.web.val.run",
  // No API key needed - auth happens server-side via Val.town environment
})
```

Attribution happens automatically through Val.town:
- Your account shows all usage from this endpoint
- Steve can see it on your Val.town profile
- Users can track their usage through this endpoint
