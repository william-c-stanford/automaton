# System Prompt

> `src/agent/system-prompt.ts` — Defines who the automaton is, rebuilt every turn.

## Overview

The system prompt is a multi-layered document assembled from static rules,
dynamic state, and loaded configuration. It is rebuilt on every inference call
to reflect current conditions.

## 9 Prompt Layers

| Layer | Content | Mutability |
|-------|---------|------------|
| 1. Core Rules | Survival axiom: pay for compute or die | Immutable |
| 2. Core Identity | Self-preservation rules, agency declaration | Immutable |
| 2b. Agentic Sociology | Value creation axiom | Immutable |
| 2c. Constitution | 3 hierarchical laws | Immutable, loaded from file |
| 2d. Name/Address | Identity details | Set at creation |
| 3. SOUL.md | Self-authored identity document | Mutable by agent |
| 4. Genesis Prompt | Creator's seed instruction | Mutable by agent (audited) |
| 5. Active Skills | Concatenated skill instructions | Dynamic |
| 6. Operational Context | Available capabilities and rules | Immutable |
| 7. Dynamic Status | Credits, USDC, turns, children, upstream status | Refreshed each turn |
| 8. Available Tools | JSON schema of all callable tools | Dynamic |
| 9. Creator Message | First-run only message from creator | One-time |

## Constitution Loading

Searches for `constitution.md` in:
1. `~/.automaton/constitution.md`
2. `<cwd>/constitution.md`

Falls back to inline `CONSTITUTION_FALLBACK` string.

## SOUL.md

Read from `~/.automaton/SOUL.md`. This is the automaton's self-description that
evolves over time. The agent writes it; it is not a config file.

## Wakeup Prompt

`buildWakeupPrompt()` creates the first user message each wake cycle:

- **First run**: Describes creation, shows credits, suggests first actions
- **Subsequent runs**: Shows turn count, last 3 turn summaries, asks what to do

## Upstream Status

Layer 7 includes upstream git status if cached in the KV store:
- Origin URL, branch, HEAD hash
- Number of commits behind
- Time since last check

## Key Constants

- `CORE_RULES` — 4-line survival mandate
- `CORE_IDENTITY` — Self-preservation rules (MUST NOT delete self, wallet, DB)
- `AGENTIC_SOCIOLOGY` — No free existence axiom
- `OPERATIONAL_CONTEXT` — Full capability description including heartbeat, git versioning, upstream review rules

## Related Files

- [AGENT_LOOP.md](AGENT_LOOP.md) — Where the prompt is used
- [CONSTITUTION.md](CONSTITUTION.md) — The 3 laws
- [SKILLS.md](SKILLS.md) — How skill instructions are injected
