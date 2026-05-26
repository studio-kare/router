# Next Steps: Val.town Implementation

## 📋 Implementation Checklist

### Phase 1: Deploy Val.town Endpoint (Today)

- [ ] Get API keys for all providers:
  - [ ] Anthropic: https://console.anthropic.com/
  - [ ] OpenAI: https://platform.openai.com/api-keys
  - [ ] OpenRouter: https://openrouter.ai/keys

- [ ] Deploy to Val.town:
  - [ ] Go to https://val.town
  - [ ] Create new HTTP val (name it something like `farmer`)
  - [ ] Copy code from `vt-endpoint/main.ts`
  - [ ] Click Save
  - [ ] Get your endpoint URL: `https://your-username-farmer.web.val.run`

- [ ] Set environment variables in Val.town:
  - [ ] Click val settings
  - [ ] Add: `ANTHROPIC_API_KEY = <your-key>`
  - [ ] Add: `OPENAI_API_KEY = <your-key>`
  - [ ] Add: `OPENROUTER_API_KEY = <your-key>`

- [ ] Test endpoint:
  ```bash
  # Replace your-username and your endpoint URL
  curl -X POST https://your-username-farmer.web.val.run/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gpt-4o",
      "messages": [{"role": "user", "content": "Say hello!"}]
    }'
  
  # Should stream back: data: {...chunk...}
  ```

### Phase 2: Configure Farmer (Today - 5 mins)

- [ ] Create `.env.production` file:
  ```bash
  DEPLOYMENT=production
  VAL_TOWN_ENDPOINT=https://your-username-farmer.web.val.run
  ```

- [ ] Update `src/infra-adapters/val-town.ts`:
  - Verify it matches your endpoint format
  - Check streaming/SSE parsing is correct

- [ ] Test locally:
  ```bash
  # First verify your endpoint works
  curl https://your-username-farmer.web.val.run/v1/models
  # Should return: {"models": ["claude-...", "gpt-4o", ...]}
  ```

### Phase 3: Run End-to-End Test (Today - 10 mins)

- [ ] Start Farmer with Val.town:
  ```bash
  DEPLOYMENT=production bun run index.ts
  ```

- [ ] Generate API key:
  ```bash
  curl -X POST http://localhost:3000/v1/keys/generate
  # Copy the returned key
  ```

- [ ] Make test request:
  ```bash
  KEY=sk_your_key_here
  curl -X POST http://localhost:3000/v1/chat/completions \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gpt-4o",
      "messages": [{"role": "user", "content": "Hi!"}],
      "privacy": 0.8
    }'
  
  # Should stream back SSE chunks
  ```

- [ ] Check quota:
  ```bash
  curl http://localhost:3000/v1/quota \
    -H "Authorization: Bearer $KEY"
  
  # Should show tokens recorded!
  ```

### Phase 4: Attribution Setup (Later - 5 mins)

- [ ] Go to your Val.town profile:
  ```
  https://val.town/u/your-username
  ```

- [ ] Verify your endpoint shows:
  - ✅ `farmer` HTTP val
  - ✅ Request count increasing
  - ✅ Logs showing activity

- [ ] Optional: Share with Steve:
  ```
  "Built Farmer - an LLM proxy for cost optimization.
   Routes requests through Val.town for attribution.
   Check it out: https://val.town/u/my-username"
  ```

### Phase 5: Ejection Path (Later - 30 mins)

- [ ] Add self-host button to frontend:
  ```tsx
  <button onClick={() => {
    window.open('https://val.town/new')
  }}>
    Deploy Your Own Endpoint
  </button>
  ```

- [ ] Create GitHub issue template with instructions:
  ```markdown
  ## Self-Host Farmer Endpoint
  
  1. Go to https://val.town
  2. Create HTTP val
  3. Copy: [code link]
  4. Set API keys
  5. Use in Farmer: VAL_TOWN_ENDPOINT=<your-url>
  ```

- [ ] Update README with self-host section

## 🚀 Quick Start Script

Create `scripts/setup-val-town.sh`:

```bash
#!/bin/bash
set -e

echo "🎯 Farmer Val.town Setup"
echo ""

# Get user input
read -p "Enter your Val.town username: " VT_USERNAME
read -p "Enter your Val.town val name (e.g. 'farmer'): " VT_VAL_NAME

ENDPOINT="https://${VT_USERNAME}-${VT_VAL_NAME}.web.val.run"

echo ""
echo "✓ Endpoint: $ENDPOINT"
echo ""

# Create .env.production
cat > .env.production << EOF
DEPLOYMENT=production
VAL_TOWN_ENDPOINT=$ENDPOINT
EOF

echo "✓ Created .env.production"
echo ""

# Test endpoint
echo "Testing Val.town endpoint..."
RESPONSE=$(curl -s "$ENDPOINT/health")

if echo "$RESPONSE" | grep -q "ok"; then
  echo "✓ Val.town endpoint is live!"
else
  echo "✗ Val.town endpoint not responding"
  echo "  Make sure you:"
  echo "  1. Deployed the HTTP val"
  echo "  2. Set environment variables"
  echo "  3. Endpoint is at: $ENDPOINT"
  exit 1
fi

echo ""
echo "✓ Ready to start Farmer with Val.town!"
echo ""
echo "To run with Val.town:"
echo "  DEPLOYMENT=production bun run index.ts"
echo ""
echo "To run locally (testing):"
echo "  DEPLOYMENT=development bun run index.ts"
```

Run it:
```bash
chmod +x scripts/setup-val-town.sh
./scripts/setup-val-town.sh
```

## 📊 Verification Checklist

After each step, verify:

```bash
# Step 1: Val.town endpoint deployed
curl https://your-endpoint/health
# Expected: {"status": "ok"}

# Step 2: Farmer configured
echo $VAL_TOWN_ENDPOINT
# Expected: https://your-username-farmer.web.val.run

# Step 3: End-to-end works
curl http://localhost:3000/health
# Expected: {"status": "ok"}

# Step 4: Can stream through Val.town
# Make request, see SSE chunks flowing

# Step 5: Attribution working
# Check Val.town dashboard, see request logs
```

## 🎯 Marketing Timeline

| When | What | How |
|------|------|-----|
| Today | Deploy endpoint | Val.town val |
| Today | Configure Farmer | .env file |
| Tomorrow | Share with Steve | Twitter/Email |
| Week 1 | Monitor attribution | Val.town dashboard |
| Week 2 | Add ejection UI | Deploy update |
| Month 1 | Get feedback | User testing |
| Month 2 | Refine based on usage | Iterate |

## 💡 Pro Tips

1. **Test streaming locally first**
   ```bash
   # Validate your endpoint before integrating
   curl -N -X POST ... 2>/dev/null | head -20
   ```

2. **Monitor Val.town logs**
   - Click "Logs" in your val
   - Watch requests come in
   - Verify streaming works

3. **Check error handling**
   ```bash
   # Test with invalid model
   curl ... -d '{"model": "invalid-model"}'
   # Should get: {"error": "Unknown model: invalid-model"}
   ```

4. **Validate API keys**
   - If 500 error = missing API key
   - Check Val.town val settings
   - Verify names match exactly

5. **Monitor response time**
   - First request: ~500ms (cold start)
   - Subsequent: ~200-300ms
   - If higher, check provider APIs

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Val.town endpoint not deployed |
| "API key not set" | Add API keys to Val.town val settings |
| "Unknown model" | Add to MODELS object in main.ts |
| Streaming stops | Check Val.town logs for errors |
| Tokens not recorded | Verify Farmer is using Val.town (check logs) |
| Slow responses | Cold start? Try 2nd request |

## 📞 Support

If something doesn't work:

1. Check Val.town logs: https://val.town/u/your-username
2. Check Farmer logs: `DEPLOYMENT=production bun run index.ts`
3. Test endpoint directly: `curl https://your-endpoint/health`
4. Verify API keys are set in Val.town
5. Check models are registered in `main.ts`

## ✨ Next Level

Once working:

- [ ] Add usage dashboard showing attribution
- [ ] Create template for users to fork
- [ ] Add cost tracking per model
- [ ] Monitor which models are popular
- [ ] Optimize Val.town endpoint
- [ ] Add custom pricing/routing rules

## Summary

```
Today (1-2 hours):
  ✅ Val.town endpoint deployed
  ✅ Farmer configured
  ✅ End-to-end tested
  ✅ Attribution flowing

Soon (next week):
  ✅ Shared with Steve
  ✅ Monitoring attribution
  ✅ Users self-hosting

Long term:
  ✅ Network effect building
  ✅ Usage data informing roadmap
  ✅ Sustainable attribution model
```

Good luck! 🚀
