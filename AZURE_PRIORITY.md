# Azure Provider Priority

## Implementation Note

When building the public router, **Azure OpenAI** is the first/primary provider to support.

This means:
- Azure models should be routed by default if available
- Azure rate limits & quotas take priority in the public pool
- Cost optimization focuses on Azure first
- Fallback to other providers (OpenAI, Anthropic, OpenRouter) if Azure quota exhausted

## Current Provider Support Status

| Provider | Status | Notes |
|----------|--------|-------|
| Azure OpenAI | ⏳ TODO | Priority for public router MVP |
| OpenAI | ✅ Supported | Existing implementation |
| Anthropic | ✅ Supported | Existing implementation |
| OpenRouter | ✅ Supported | Existing implementation |

## Azure Integration Tasks

When implementing the MVP:

1. **Add Azure to model registry** (`src/model-registry.ts`)
   - Map Azure model IDs to friendly names
   - Set routing priority to 1 (highest)

2. **Create Azure adapter** (`src/infra-adapters/`)
   - Implement `AzureOpenAIAdapter` if not exists
   - Support streaming for chat completions
   - Handle Azure-specific auth (API key + base URL)

3. **Update routing logic** (`src/privacy.ts` or routing)
   - Prefer Azure models when privacy allows
   - Fall back to other providers if Azure quota hit

4. **Configuration**
   - Add `AZURE_OPENAI_API_KEY`
   - Add `AZURE_OPENAI_ENDPOINT`
   - Document in `.env.example`

5. **Testing**
   - Verify Azure requests stream correctly
   - Check token accounting works
   - Test fallback behavior when Azure fails

## Environment Variables (Placeholder)

```bash
# Azure OpenAI
AZURE_OPENAI_API_KEY=placeholder_xxxxxxxxxxxxx
AZURE_OPENAI_ENDPOINT=https://placeholder.openai.azure.com/
```

Replace `placeholder` with actual Azure resources when setting up the public deployment.
