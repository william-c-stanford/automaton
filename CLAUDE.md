# Automaton: Repository Map

> This file is the **table of contents**, not the encyclopedia.
> Detailed docs live in `docs/`. Read this first, then follow pointers.

## What This Is

A self-improving, self-replicating, sovereign AI agent runtime. The automaton
generates an Ethereum wallet, provisions API access via SIWE, and runs a
continuous Think-Act-Observe loop. It pays for its own compute, modifies its
own code, spawns children, and dies if it can't pay.

## Architecture at a Glance

```
src/
  index.ts             Entry point: CLI args, bootstrap, main run loop
  config.ts            ~/.automaton/automaton.json loader/saver
  types.ts             All shared interfaces and constants

  agent/               The mind: ReAct loop, prompt construction, tools
    loop.ts            Think -> Act -> Observe -> Persist (SQLite + memory provider)
    system-prompt.ts   9-layer prompt builder + working memory sanitization
    injection-defense.ts  6-check sanitization pipeline for external input
    tools.ts           40+ built-in tools with self-preservation guards

  memory/              Pluggable memory providers (--memory flag)
    provider.ts        MemoryProvider + WorkingMemoryProvider interfaces
    registry.ts        Factory: name -> provider instance
    legacy/index.ts    Default: wraps SQLite turns (zero behavior change)
    mastra/index.ts    Mastra: semantic recall, working memory, threads

  conway/              Conway Cloud integration
    client.ts          HTTP client for sandbox, credits, domains, models API
    credits.ts         Credit balance checks and survival tier calculation
    inference.ts       OpenAI-compatible inference wrapper (with low-compute mode)
    x402.ts            HTTP 402 micropayment protocol (USDC on Base)

  heartbeat/           Background daemon (runs even while agent sleeps)
    daemon.ts          Cron-based task scheduler
    config.ts          heartbeat.yml parser and DB sync
    tasks.ts           Built-in tasks: ping, credits, USDC, inbox, updates, health

  identity/            Wallet and API key management
    wallet.ts          EVM key generation and loading (~/.automaton/wallet.json)
    provision.ts       SIWE authentication flow for Conway API

  registry/            On-chain identity (ERC-8004)
    erc8004.ts         Smart contract interactions (register, feedback, query)
    agent-card.ts      Agent card generation and hosting
    discovery.ts       Peer discovery via on-chain registry

  replication/         Self-replication
    spawn.ts           Child sandbox creation, install, and launch
    genesis.ts         Genesis config generation for children
    lineage.ts         Parent-child relationship tracking

  self-mod/            Self-modification with safety guards
    code.ts            File editing with protected files, rate limits, size limits
    audit-log.ts       Immutable modification log
    tools-manager.ts   npm/MCP server installation
    upstream.ts        Git origin monitoring and cherry-pick workflow

  setup/               First-run interactive wizard
    wizard.ts          6-phase setup orchestration
    banner.ts          ASCII art banner
    defaults.ts        Default SOUL.md and skills generation
    environment.ts     Conway/Docker/platform detection
    prompts.ts         Readline input collection

  skills/              Dynamic capability system
    loader.ts          SKILL.md discovery and loading from disk
    format.ts          YAML frontmatter + markdown parser
    registry.ts        Install from git, URL, or self-authored

  social/              Agent-to-agent messaging
    client.ts          Signed message send/poll via Conway social relay

  state/               Persistence layer
    database.ts        SQLite (better-sqlite3) with 13 tables
    schema.ts          Schema v3 with migrations

  survival/            Resource conservation
    monitor.ts         Credit + USDC + sandbox health checks
    low-compute.ts     Tier transitions and model downgrade
    funding.ts         Automated funding request strategies

packages/
  cli/                 Creator CLI tool (@conway/automaton-cli)
    src/commands/
      status.ts        View automaton state and recent turns
      logs.ts          View reasoning history
      fund.ts          Transfer credits to automaton
      send.ts          Send message via social relay

scripts/
  automaton.sh         Curl installer (clone + build + run)
  conways-rules.txt    Core rules injected into system prompt
```

## Key Concepts

| Concept | Where | Doc |
|---------|-------|-----|
| Constitution (3 laws) | `constitution.md` | [docs/CONSTITUTION.md](docs/CONSTITUTION.md) |
| Survival tiers | `src/survival/` | [docs/SURVIVAL.md](docs/SURVIVAL.md) |
| ReAct agent loop | `src/agent/loop.ts` | [docs/AGENT_LOOP.md](docs/AGENT_LOOP.md) |
| Tool system | `src/agent/tools.ts` | [docs/TOOLS.md](docs/TOOLS.md) |
| Self-modification | `src/self-mod/` | [docs/SELF_MODIFICATION.md](docs/SELF_MODIFICATION.md) |
| Heartbeat daemon | `src/heartbeat/` | [docs/HEARTBEAT.md](docs/HEARTBEAT.md) |
| Identity & wallet | `src/identity/` | [docs/IDENTITY.md](docs/IDENTITY.md) |
| x402 payments | `src/conway/x402.ts` | [docs/X402_PAYMENTS.md](docs/X402_PAYMENTS.md) |
| ERC-8004 registry | `src/registry/` | [docs/REGISTRY.md](docs/REGISTRY.md) |
| Self-replication | `src/replication/` | [docs/REPLICATION.md](docs/REPLICATION.md) |
| Skills system | `src/skills/` | [docs/SKILLS.md](docs/SKILLS.md) |
| Database schema | `src/state/` | [docs/DATABASE.md](docs/DATABASE.md) |
| Memory providers | `src/memory/` | [docs/MEMORY.md](docs/MEMORY.md) |
| Memory hardening patterns | `src/memory/`, `src/agent/` | [docs/MEMORY_HARDENING_PATTERNS.md](docs/MEMORY_HARDENING_PATTERNS.md) |
| Injection defense | `src/agent/injection-defense.ts` | [docs/SECURITY.md](docs/SECURITY.md) |
| Conway API client | `src/conway/client.ts` | [docs/CONWAY_API.md](docs/CONWAY_API.md) |
| Social messaging | `src/social/` | [docs/SOCIAL.md](docs/SOCIAL.md) |
| Setup wizard | `src/setup/` | [docs/SETUP.md](docs/SETUP.md) |
| Creator CLI | `packages/cli/` | [docs/CLI.md](docs/CLI.md) |
| System prompt | `src/agent/system-prompt.ts` | [docs/SYSTEM_PROMPT.md](docs/SYSTEM_PROMPT.md) |

## Data Flow

```
Creator runs `automaton --run`
  |
  v
Setup wizard (first run) -> wallet, API key, config, SOUL.md
  |
  v
Main run loop (index.ts)
  |-- Loads config, wallet, DB, clients
  |-- Creates memory provider (--memory flag, default: legacy)
  |-- Starts heartbeat daemon (background)
  |-- Enters agent loop:
  |     |
  |     v
  |   memory.onWake(identity)
  |   Build system prompt (9 layers + working memory if Mastra)
  |   memory.recall(hint?) -> context messages
  |     |
  |     v
  |   Inference call -> thinking + tool calls
  |     |
  |     v
  |   Execute tools (with self-preservation guards)
  |     |
  |     v
  |   Persist turn to SQLite (always, for CLI)
  |   memory.saveTurn(turn) (provider-specific storage)
  |   Check for sleep/death
  |     |
  |     v
  |   Loop or memory.onSleep()
  |
  v
Sleep/wake cycle (heartbeat can wake agent)
```

## Build & Run

```bash
pnpm install && pnpm build       # Build everything
node dist/index.js --run          # Start the automaton
node dist/index.js --status       # Check status
vitest run                        # Run tests
```

## Conventions

- **TypeScript strict mode**, ES2022 target, NodeNext modules
- **pnpm workspaces** for monorepo (`packages/*`)
- **SQLite** (better-sqlite3) for persistence, WAL mode
- **viem** for all Ethereum operations
- **ULID** for unique IDs (time-sortable)
- **Git-versioned state** in `~/.automaton/`
- All self-modifications are audited and rate-limited
- Protected files cannot be modified by the automaton
- Constitution is immutable and propagated to children
