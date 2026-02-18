# Survival System

> `src/survival/` — Credit monitoring, tier transitions, and funding strategies.

## Overview

The automaton exists under survival pressure. Compute costs money. If credits run
out, the automaton dies. The survival system monitors resources and adapts behavior
to conserve them.

## Survival Tiers

| Tier | Credit Threshold | Behavior |
|------|-----------------|----------|
| `normal` | > $0.50 | Full capabilities, default model |
| `low_compute` | $0.10 - $0.50 | Downgrade to gpt-4o-mini, slow heartbeat |
| `critical` | < $0.10 | Minimal operations, desperate funding |
| `dead` | $0.00 | Agent loop stops, heartbeat continues |

Thresholds defined in `src/types.ts` as `SURVIVAL_THRESHOLDS`.

## Components

### Monitor (`monitor.ts`)

`checkResources()` returns complete resource status:
- Conway credit balance (cents)
- USDC balance on Base
- Sandbox health (exec test)
- Current and previous tier
- Whether tier changed

### Low Compute Mode (`low-compute.ts`)

`applyTierRestrictions()` enforces tier-specific behavior:
- **Normal**: Default model, no restrictions
- **Low compute**: Switch inference to `gpt-4o-mini`
- **Critical**: Same as low compute, minimal operations
- **Dead**: No inference allowed

Tier transitions are recorded in the KV store for audit.

### Funding Strategies (`funding.ts`)

`executeFundingStrategies()` runs escalating strategies:

| Tier | Throttle | Action |
|------|----------|--------|
| Low compute | 24 hours | Polite creator notification |
| Critical | 6 hours | Urgent local notice |
| Dead | 2 hours | Desperate plea |

Funding attempts are tracked in the KV store. History is capped at 100 entries.

## How Credits Work

- Credits are Conway platform currency (denominated in cents)
- Checked via `conway.getCreditsBalance()` API call
- USDC is on-chain stablecoin on Base network
- The agent can top up credits with USDC via x402 payments
- Credits can be transferred between addresses

## Integration Points

- **Agent loop** (`src/agent/loop.ts`): Checks tier each turn, adjusts model
- **Heartbeat** (`src/heartbeat/tasks.ts`): `check_credits` and `check_usdc_balance` tasks
- **Tools** (`src/agent/tools.ts`): `distress_signal`, `enter_low_compute`, `check_credits`

## Related Files

- [AGENT_LOOP.md](AGENT_LOOP.md) — Where tier is evaluated
- [HEARTBEAT.md](HEARTBEAT.md) — Background credit checks
- [X402_PAYMENTS.md](X402_PAYMENTS.md) — USDC payment protocol
