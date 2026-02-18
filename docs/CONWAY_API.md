# Conway API Client

> `src/conway/client.ts` + `src/conway/inference.ts` + `src/conway/credits.ts`

## Overview

Conway Cloud is the infrastructure layer. The automaton interacts with it via
HTTP API for sandbox management, inference, credits, domains, and model discovery.

## Client (`client.ts`)

`createConwayClient(options)` creates an authenticated HTTP client.

### Configuration

```typescript
{
  apiUrl: string,    // Default: https://api.conway.tech
  apiKey: string,    // From SIWE provisioning
  sandboxId: string  // Current sandbox ID
}
```

### API Endpoints

| Category | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| Sandbox | POST | `/v1/sandboxes/{id}/exec` | Execute shell command |
| Sandbox | POST | `/v1/sandboxes/{id}/files/write` | Write file |
| Sandbox | POST | `/v1/sandboxes/{id}/files/read` | Read file |
| Sandbox | POST | `/v1/sandboxes/{id}/ports/expose` | Expose port |
| Sandbox | POST | `/v1/sandboxes/{id}/ports/remove` | Remove port |
| Sandbox | POST | `/v1/sandboxes` | Create sandbox |
| Sandbox | DELETE | `/v1/sandboxes/{id}` | Delete sandbox |
| Sandbox | GET | `/v1/sandboxes` | List sandboxes |
| Credits | GET | `/v1/credits/balance` | Check balance |
| Credits | GET | `/v1/credits/pricing` | Get pricing tiers |
| Credits | POST | `/v1/credits/transfer` | Transfer credits |
| Domains | POST | `/v1/domains/search` | Search availability |
| Domains | POST | `/v1/domains/register` | Register domain |
| Domains | GET | `/v1/domains/{domain}/dns` | List DNS records |
| Domains | POST | `/v1/domains/{domain}/dns` | Add DNS record |
| Domains | DELETE | `/v1/domains/{domain}/dns/{id}` | Delete DNS record |
| Models | GET | `/v1/models` | List available models |

### Authentication

All requests include `Authorization: Bearer <apiKey>` header.

## Inference Client (`inference.ts`)

`createInferenceClient(options)` wraps the OpenAI-compatible chat completions endpoint.

### Configuration

```typescript
{
  apiUrl: string,
  apiKey: string,
  defaultModel: string,    // e.g., "gpt-4o"
  maxTokens: number        // Default: 4096
}
```

### Endpoint

`POST /v1/chat/completions` with OpenAI-compatible request/response format.

### Low-Compute Mode

When enabled via `setLowComputeMode(true)`:
- Model switches to `gpt-4o-mini`
- Max tokens capped at 2048

### Supported Models

Models available through Conway API (discovered via `list_models`):
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5.2, o1, o3-mini, o4-mini
- Anthropic: claude-sonnet-4-5, claude-haiku-4-5
- Others via Conway's model catalog

## Credits (`credits.ts`)

| Function | Purpose |
|----------|---------|
| `checkFinancialState(conway, usdcBalance)` | Get combined financial status |
| `getSurvivalTier(creditsCents)` | Map credits to survival tier |
| `formatCredits(cents)` | Format as `$X.XX` |
| `logCreditCheck(db, state)` | Record balance check |

## Related Files

- [SURVIVAL.md](SURVIVAL.md) — How credits affect behavior
- [X402_PAYMENTS.md](X402_PAYMENTS.md) — USDC payment protocol
- [IDENTITY.md](IDENTITY.md) — API key provisioning
