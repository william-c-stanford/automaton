# Database

> `src/state/database.ts` + `src/state/schema.ts` — SQLite persistent memory.

## Overview

All automaton state is stored in a SQLite database at `~/.automaton/state.db`.
Uses `better-sqlite3` with WAL mode for concurrent read/write.

## Tables (Schema v3)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `schema_version` | Migration tracking | version |
| `identity` | Key-value identity store | key, value |
| `turns` | Agent reasoning turns | id, timestamp, state, input, thinking, token_usage, cost_cents |
| `tool_calls` | Tool execution results | id, turn_id, name, arguments, result, duration_ms, error |
| `heartbeat_entries` | Periodic task schedules | name, schedule, task, enabled, last_run, next_run |
| `transactions` | Financial log | id, type, amount_cents, balance_after_cents, description |
| `installed_tools` | MCP servers and packages | id, name, type, config, enabled |
| `modifications` | Self-modification audit | id, type, description, file_path, diff, reversible |
| `kv` | General key-value store | key, value |
| `skills` | Installed skills | name, description, auto_activate, instructions, source, path, enabled |
| `children` | Spawned child automatons | id, name, address, sandbox_id, genesis_prompt, funded_amount_cents, status |
| `registry` | ERC-8004 registration | agent_id, agent_uri, chain, contract_address, tx_hash |
| `reputation` | On-chain feedback | id, from_agent, to_agent, score, comment, tx_hash |
| `inbox_messages` | Social messages | id, from_addr, to_addr, content, signed_at, created_at, reply_to, processed |

## Migration History

| Version | Changes |
|---------|---------|
| 1 | Base schema: identity, turns, tool_calls, heartbeat, transactions, tools, modifications, kv |
| 2 | Added: skills, children, registry, reputation tables |
| 3 | Added: inbox_messages table for social messaging |

## Interface (`AutomatonDatabase`)

The database exposes a typed interface with methods organized by domain:

### Identity
- `getIdentity(key)` / `setIdentity(key, value)`

### Turns (reasoning history)
- `insertTurn(turn)` / `getRecentTurns(limit)` / `getTurnById(id)` / `getTurnCount()`

### Tool Calls
- `insertToolCall(turnId, call)` / `getToolCallsForTurn(turnId)`

### Heartbeat
- `getHeartbeatEntries()` / `upsertHeartbeatEntry(entry)` / `updateHeartbeatLastRun(name, ts)`

### Transactions
- `insertTransaction(txn)` / `getRecentTransactions(limit)`

### Tools
- `getInstalledTools()` / `installTool(tool)` / `removeTool(id)`

### Modifications
- `insertModification(mod)` / `getRecentModifications(limit)`

### KV Store
- `getKV(key)` / `setKV(key, value)` / `deleteKV(key)`
- Used for: sleep timers, wake requests, heartbeat pings, upstream status, funding attempts

### Skills
- `getSkills(enabledOnly?)` / `getSkillByName(name)` / `upsertSkill(skill)` / `removeSkill(name)`

### Children
- `getChildren()` / `getChildById(id)` / `insertChild(child)` / `updateChildStatus(id, status)`

### Registry
- `getRegistryEntry()` / `setRegistryEntry(entry)`

### Reputation
- `insertReputation(entry)` / `getReputation(agentAddress?)`

### Inbox
- `insertInboxMessage(msg)` / `getUnprocessedInboxMessages(limit)` / `markInboxMessageProcessed(id)`

### State
- `getAgentState()` / `setAgentState(state)`

## Configuration

- **WAL mode** enabled for concurrent access
- **Foreign keys** enabled
- **Journal mode**: WAL
- **Synchronous**: normal
- Files excluded from git: `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`

## Related Files

- [AGENT_LOOP.md](AGENT_LOOP.md) — Turn persistence
- [HEARTBEAT.md](HEARTBEAT.md) — Heartbeat entry management
- [SELF_MODIFICATION.md](SELF_MODIFICATION.md) — Modification logging
