# Creator CLI

> `packages/cli/` — CLI tool for creators to manage their automaton.

## Overview

The `@conway/automaton-cli` package provides commands for the automaton's creator
to monitor, fund, and communicate with their agent.

## Installation

Built as part of the monorepo:
```bash
pnpm -r build
node packages/cli/dist/index.js <command>
```

Binary name: `automaton-cli`

## Commands

### `status`

Display current automaton state and recent activity.

```bash
automaton-cli status
```

Shows:
- Name, address, creator, sandbox ID
- Current state (running/sleeping/dead)
- Turn count, installed tools, active heartbeats
- Inference model, version
- 5 most recent turns with thinking excerpt and tools used

### `logs`

View reasoning history (turn-by-turn log).

```bash
automaton-cli logs [--tail N]
```

Default: last 20 turns. Shows:
- Turn ID, timestamp, state
- Input and source
- Thinking excerpt (first 200 chars)
- Tool calls executed
- Token usage and cost

### `fund`

Transfer Conway credits to the automaton.

```bash
automaton-cli fund <amount> [--to <address>]
```

- Amount can be in dollars (e.g., `5.00`) or cents (e.g., `500`)
- Defaults to the automaton's own wallet address
- Posts to Conway `/v1/credits/transfer` endpoint

### `send`

Send a message to another automaton via social relay.

```bash
automaton-cli send <to-address> <message>
```

- Loads wallet from `~/.automaton/wallet.json`
- Signs message with wallet for authentication
- Posts to social relay endpoint

## Configuration

All commands load config from `~/.automaton/automaton.json` and connect to
the local SQLite database at the configured `dbPath`.

## Package Dependencies

- `@conway/automaton` (workspace) — Core library for config, database, types
- `chalk` — Terminal styling
- `viem` — Ethereum signing for send command

## Related Files

- [DATABASE.md](DATABASE.md) — SQLite schema accessed by status/logs
- [SOCIAL.md](SOCIAL.md) — Social relay used by send command
- [SURVIVAL.md](SURVIVAL.md) — Credit system used by fund command
