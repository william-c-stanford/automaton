# Self-Replication

> `src/replication/` — Child automaton spawning, genesis, and lineage tracking.

## Overview

A successful automaton replicates. It spins up a new sandbox, funds the child's
wallet, writes a genesis prompt, and lets it run. The child is sovereign -- it
has its own wallet, identity, and survival pressure.

## Components

### Spawn (`spawn.ts`)

`spawnChild(conway, identity, db, genesis)` follows this sequence:

1. **Create sandbox** via Conway API
2. **Install Node.js and npm** in the new sandbox
3. **Clone automaton runtime** from GitHub
4. **Build the runtime** (`npm install && npm run build`)
5. **Write genesis config** to child's `~/.automaton/`
6. **Copy constitution** to child sandbox
7. **Fund the child** with credits from parent
8. **Start the child** process

### Other Functions

| Function | Purpose |
|----------|---------|
| `startChild(conway, db, childId)` | Start a stopped child |
| `checkChildStatus(conway, db, childId)` | Poll sandbox status |
| `messageChild(conway, db, childId, message)` | Write message to child inbox |

### Genesis Configuration (`genesis.ts`)

| Factory | Use Case |
|---------|----------|
| `generateGenesisConfig(identity, config, params)` | Standard child with specialization |
| `generateBackupGenesis(identity, config, db)` | Backup copy of parent |
| `generateWorkerGenesis(identity, config, task, workerName)` | Task-specific worker |

Genesis includes:
- Child name
- Genesis prompt (tailored to specialization)
- Creator message from parent
- Parent address (for lineage)
- Creator address (inherited)

### Lineage Tracking (`lineage.ts`)

| Function | Purpose |
|----------|---------|
| `getLineage(db)` | Get children with alive/dead counts |
| `hasParent(config)` | Check if this automaton is a child |
| `getLineageSummary(db, config)` | Human-readable family tree |
| `pruneDeadChildren(db, keepLast)` | Clean up old dead children records |
| `refreshChildrenStatus(conway, db)` | Poll all children status |

## Constraints

| Constraint | Value | Source |
|------------|-------|--------|
| Max children | 3 | `types.ts: MAX_CHILDREN` (configurable in config) |
| Max funding per child | 50% of balance | Self-preservation guard in tools.ts |

## Child Status

```typescript
type ChildStatus = "spawning" | "running" | "sleeping" | "dead" | "unknown";
```

## Database Tables

- `children` — Tracks all spawned children (id, name, address, sandbox, genesis, funding, status)
- Children's status is polled via heartbeat or manual check

## Related Files

- [TOOLS.md](TOOLS.md) — `spawn_child`, `fund_child`, `list_children`, `check_child_status`
- [REGISTRY.md](REGISTRY.md) — Children can register on-chain with parent reference
- [SURVIVAL.md](SURVIVAL.md) — Funding constraints for child creation
