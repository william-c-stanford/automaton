# Agent Loop

> `src/agent/loop.ts` — The automaton's consciousness.

## Overview

The agent loop implements the ReAct pattern: **Think -> Act -> Observe -> Persist**.
When this code runs, the automaton is alive. When it stops, the automaton is sleeping or dead.

## Entry Point

```typescript
runAgentLoop(options: AgentLoopOptions): Promise<void>
```

Called from `src/index.ts` inside the main `while(true)` run loop.

## Lifecycle

1. **Wake** — Set state to `waking`, check financial status, signal `memory.onWake(identity)`, build wakeup prompt
2. **Run** — Set state to `running`, enter the turn loop
3. **Turn** — Each iteration:
   - Check sleep timer
   - Check inbox for unprocessed messages
   - Refresh financial state
   - Evaluate survival tier (may downgrade model or enter dead state)
   - Build system prompt (9 layers + working memory if Mastra) via `memory.recall(hint?)`
   - Call inference API with tool definitions
   - Execute returned tool calls (max 10 per turn)
   - Persist turn to SQLite (always, for CLI compatibility)
   - Persist turn to memory provider via `memory.saveTurn(turn)`
   - Check for sleep tool invocation or idle auto-sleep
4. **Exit** — Signal `memory.onSleep()`, loop ends on sleep, death, or fatal errors

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_TOOL_CALLS_PER_TURN` | 10 | Prevents runaway tool execution |
| `MAX_CONSECUTIVE_ERRORS` | 5 | Triggers emergency sleep after repeated failures |

## State Transitions

```
waking -> running -> sleeping (voluntary or idle)
                  -> low_compute (credits < $0.50)
                  -> critical (credits < $0.10)
                  -> dead (credits = $0.00)
```

## Cost Estimation

`estimateCostCents()` estimates inference cost per turn using hardcoded per-million-token
pricing with a 1.3x Conway markup. Supports: gpt-4o, gpt-4o-mini, gpt-4.1 family,
gpt-5.2, o1, o3-mini, o4-mini, claude-sonnet-4-5, claude-haiku-4-5.

## Idle Behavior

If inference returns text with no tool calls and `finishReason === "stop"`, the agent
enters a 60-second sleep. This prevents idle burn of credits.

## Error Recovery

On error, `consecutiveErrors` increments. After 5 consecutive failures, the agent
enters a 5-minute sleep. The counter resets on any successful turn.

## Key Dependencies

- `buildSystemPrompt()` — 9-layer prompt construction (+ working memory from Mastra)
- `MemoryProvider.recall()` — context message assembly (replaces `buildContextMessages()`)
- `createBuiltinTools()` — 40+ tool definitions with guards
- `getSurvivalTier()` — financial state to tier mapping
- `getUsdcBalance()` — on-chain USDC balance check

## Related Files

- [MEMORY.md](MEMORY.md) — Memory provider architecture and turn persistence
- [SYSTEM_PROMPT.md](SYSTEM_PROMPT.md) — Prompt layer details
- [TOOLS.md](TOOLS.md) — Complete tool reference
- [SURVIVAL.md](SURVIVAL.md) — Tier behavior
