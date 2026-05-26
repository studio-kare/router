# Val.town Endpoint Deployment Guide

## Quick Start (5 minutes)

### 1. Deploy to Val.town

Go to https://val.town and create a new HTTP val:

1. Click "New val"
2. Choose "HTTP"
3. Copy the code from `main.ts`
4. Paste it into your val
5. Click "Save"

Your val is now live at: `https://your-username-val-name.web.val.run`

### 2. Set Environment Variables

In your Val.town val settings, add these secrets:

```
ANTHROPIC_API_KEY = sk-ant-xxxxx
OPENAI_API_KEY = sk-xxxxx
OPENROUTER_API_KEY = xxxxx
```

**Getting API Keys:**

- **Anthropic:** https://console.anthropic.com/
- **OpenAI:** https://platform.openai.com/api-keys
- **OpenRouter:** https://openrouter.ai/keys

### 3. Test It

```bash
curl -X POST https://your-username-val-name.web.val.run/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Say hello!"}]
  }'
```

Expected response: Server-Sent Events stream with chat chunks

### 4. Use in Farmer

Update your Farmer config:

```typescript
// .env
VAL_TOWN_ENDPOINT=https://your-username-val-name.web.val.run
```

Or in code:

```typescript
const valTownAdapter = createValTownAdapter({
  endpointUrl: process.env.VAL_TOWN_ENDPOINT,
})
```

## Attribution & Marketing

This endpoint is deployed under **your** Val.town account, so:

✅ All usage is attributed to you
✅ Steve can see Farmer traffic on your Val.town profile
✅ Demonstrates Farmer's capability on Val.town
✅ Network effect: "This is what Farmer can do"

## Customization

### Add More Models

Edit the `MODELS` object in `main.ts`:

```typescript
const MODELS: Record<string, ModelInfo> = {
  // ... existing models
  "claude-4": { provider: "anthropic", maxTokens: 400000 },
  "gpt-5": { provider: "openai", maxTokens: 200000 },
}
```

### Add Custom Logic

You can add:
- Custom rate limiting
- Usage tracking/logging
- Request validation
- Response caching
- Cost tracking

## Ejection Path for Users

Want to give users their own endpoint?

### Option 1: Template URL
Provide this link:
```
https://val.town/new?source=https://...your-endpoint...
```

Users can:
1. Click the link
2. View your code
3. Click "Create a copy" 
4. Set their own API keys
5. Get their own endpoint URL
6. Use it in Farmer

### Option 2: Copy Instructions
Provide step-by-step guide:
1. Go to Val.town
2. Create new HTTP val
3. Copy our code from GitHub
4. Set your API keys
5. Your endpoint is ready

### Option 3: Automated Ejection
Create a button in Farmer UI:
```typescript
<button onClick={() => {
  window.open(`https://val.town/new?source=${TEMPLATE_URL}`)
}}>
  Deploy Your Own Endpoint
</button>
```

## Monitoring & Debugging

### Check Endpoint Status
```bash
curl https://your-username-val-name.web.val.run/health
# {"status": "ok"}
```

### List Available Models
```bash
curl https://your-username-val-name.web.val.run/v1/models
# {"models": ["claude-3.5-sonnet", "gpt-4o", ...]}
```

### Val.town Logs
In your val editor, click "Logs" to see:
- Request/response logs
- Error messages
- API call details

### Test Different Models
```bash
# Test Anthropic
curl -X POST ... -d '{"model": "claude-3.5-sonnet", ...}'

# Test OpenAI
curl -X POST ... -d '{"model": "gpt-4o", ...}'

# Test OpenRouter
curl -X POST ... -d '{"model": "meta-llama/llama-3.1-8b-instruct", ...}'
```

## Performance Tips

### 1. Lazy Client Initialization
The endpoint creates SDK clients on first use (not at startup):
```typescript
const getAnthropicClient = () => {
  if (!anthropicClient) {
    anthropicClient = new Anthropic(...)
  }
  return anthropicClient
}
```

### 2. Streaming
All responses stream (Server-Sent Events):
- Lower latency
- Lower memory usage
- Better user experience

### 3. Error Handling
Missing API key? The endpoint tells you:
```
{"error": "Missing API key: ANTHROPIC_API_KEY not set"}
```

## Troubleshooting

### "API key not set"
- Go to your Val.town val settings
- Add the environment variable
- Make sure the name matches exactly (case-sensitive)

### "Unknown model"
- Check the model name spelling
- Add it to the MODELS object if it's new

### Streaming not working
- Check response headers: `Content-Type: text/event-stream`
- Check that your client reads SSE format: `data: {...}\n\n`

### Connection timeout
- Val.town endpoint might be cold-starting
- First request takes ~500ms, subsequent are fast
- Consider keeping it warm with periodic pings

## Next Steps

1. ✅ Deploy endpoint
2. ✅ Set API keys
3. ✅ Test with curl
4. ✅ Update Farmer config
5. ✅ Deploy Farmer with Val.town routing
6. ✅ Monitor usage in Val.town
7. ✅ Market to Steve 🎯

## Marketing Attribution

Once deployed, Steve and others can see:
- Your Val.town profile shows this endpoint
- Usage graphs show traffic patterns
- Demonstrates Farmer's capability
- "Built with Farmer on Val.town"

Share the link: `https://val.town/u/your-username`
