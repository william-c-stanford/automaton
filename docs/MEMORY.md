# Memory System

> `src/memory/` — Pluggable memory provider architecture.

## Overview

The memory system provides a pluggable interface for turn history, context
building, and recall. The agent loop interacts with memory through a single
`MemoryProvider` interface. Backend selection happens at startup via CLI flag:

```
automaton --run                     # legacy SQLite (default)
automaton --run --memory mastra     # Mastra memory backend
automaton --run --memory <name>     # any registered provider
```

## Architecture

```
src/memory/
  provider.ts          MemoryProvider + WorkingMemoryProvider interfaces
  registry.ts          Factory: maps --memory flag to provider instance

  legacy/
    index.ts           Default provider wrapping SQLite (zero behavior change)

  mastra/
    index.ts           Mastra provider: semantic recall, working memory, threads
```

The agent loop (`src/agent/loop.ts`) calls:
1. `memory.onWake(identity)` at loop start
2. `memory.recall(hint?)` to build context messages each turn
3. `db.insertTurn()` + `db.insertToolCall()` for CLI compatibility (always)
4. `memory.saveTurn(turn)` for provider-specific storage
5. `memory.onSleep()` when the loop exits

The system prompt builder (`src/agent/system-prompt.ts`) optionally injects
working memory via `hasWorkingMemory(memory)`. Working memory content is
sanitized (delimiter stripping, 4000-char truncation) before injection.

### Turn Persistence

The agent loop always writes turns to the operational SQLite database,
regardless of which memory provider is active. This ensures CLI tools
(`automaton --status`, `logs`) always have access to turn data. The memory
provider's `saveTurn()` handles any additional storage (e.g., Mastra threads
for semantic recall).

## Interface

```typescript
interface MemoryProvider {
  readonly name: string;
  init(): Promise<void>;
  saveTurn(turn: AgentTurn): Promise<void>;
  recall(hint?: string): Promise<ChatMessage[]>;
  getTurnCount(): number;
  getRecentTurns(limit: number): AgentTurn[];
  onWake(identity: AutomatonIdentity): Promise<void>;
  onSleep(): Promise<void>;
  close(): Promise<void>;
}

// Optional extension for providers with structured working memory
interface WorkingMemoryProvider {
  getWorkingMemory(): Promise<string | null>;
}

function hasWorkingMemory(p: MemoryProvider): p is MemoryProvider & WorkingMemoryProvider;
```

## Providers

| Provider | Flag | Backend | Features |
|----------|------|---------|----------|
| Legacy | `--memory legacy` (default) | SQLite (better-sqlite3) | Fixed 20-turn context window, tool call replay |
| Mastra | `--memory mastra` | LibSQL + fastembed | Semantic recall, working memory, threads |

### Legacy Provider (`src/memory/legacy/index.ts`)

Zero-behavior-change wrapper around the existing SQLite code:

- `saveTurn()` is a no-op — the agent loop persists turns to SQLite directly
  (see "Turn Persistence" below)
- `recall()` fetches the last 20 turns via `db.getRecentTurns()` and converts
  them to `ChatMessage[]` with `buildContextMessages()`
- `onWake()`/`onSleep()` are no-ops
- Turn count and recent turns read directly from SQLite

This provider preserves full backward compatibility. The CLI
(`packages/cli/`) continues to read from SQLite directly.

### Mastra Provider (`src/memory/mastra/index.ts`)

Uses `@mastra/memory` with LibSQL storage and optional fastembed vector search:

- **Thread-per-wake-cycle** — each `onWake()` creates a new Mastra thread,
  giving natural session boundaries
- **Semantic recall** — when `recall(hint)` receives a hint string, it runs
  vector search over the thread's message history, surfacing relevant past
  context beyond the recency window (top-K=5, messageRange before=2, after=1)
- **Working memory** — implements `WorkingMemoryProvider`. Mastra maintains a
  structured working memory blob (goals, facts, projects, contacts) that
  persists across turns and is injected into the system prompt
- **Last-N messages** — always retrieves the last 40 messages for recency
  context, with or without semantic search

#### Configuration

```typescript
interface MastraMemoryOptions {
  storageUrl?: string;           // default: "file:~/.automaton/memory.db"
  vectorUrl?: string;            // default: "file:~/.automaton/vector-memory.db"
  enableSemanticRecall?: boolean; // default: true (opt-out)
}
```

When `enableSemanticRecall` is `false`, the provider skips the fastembed
embedder and LibSQLVector entirely — no ONNX model is downloaded and startup
is fast.

#### Embeddings

Semantic recall uses `@mastra/fastembed` (bge-small-en-v1.5, 384 dimensions).
The ONNX model (~33 MB) is downloaded to `~/.cache/mastra/fastembed-models/`
on first use and cached for subsequent runs.

#### Message Format

Turns are converted to Mastra's V2 content format:

```typescript
{
  id: `${turn.id}-input`,
  role: "user",
  content: {
    format: 2,
    parts: [{ type: "text", text: "[source] input text" }],
  },
  createdAt: new Date(turn.timestamp),
  threadId: this.currentThreadId,
  resourceId: this.resourceId,
}
```

Tool results are stored as assistant messages with `[tool:name]` prefix.

## Registry (`src/memory/registry.ts`)

Maps provider names to factory functions:

```typescript
createMemoryProvider(name: string, config: AutomatonConfig, db: AutomatonDatabase): MemoryProvider
getAvailableProviders(): string[]
```

Unknown names throw with a list of available providers.

## Boundary: Memory vs. Operational State

Memory providers handle **turn history and context** only. Everything else
stays in the operational SQLite database:

| Owned by Memory Provider | Owned by Operational DB |
|--------------------------|------------------------|
| Turn history | Heartbeat entries |
| Context messages | Transactions |
| Semantic recall | Installed tools |
| Working memory | Modifications audit |
| Thread management | KV store |
| | Skills |
| | Children |
| | Registry |
| | Reputation |
| | Inbox messages |
| | Agent state |

## Adding a New Provider

1. Create `src/memory/<name>/index.ts` implementing `MemoryProvider`
2. Register in `src/memory/registry.ts` (add one line to `PROVIDERS` map)
3. Add deps to `package.json` if needed
4. Document here

## Testing

Tests live in `src/__tests__/`:

| File | What it tests | Speed |
|------|---------------|-------|
| `mastra-memory.test.ts` | Core Mastra provider (semantic off) + opt-out path | Fast (~2s) |
| `mastra-semantic.test.ts` | Semantic recall with real fastembed | Slow (~30-120s, downloads model) |

All tests use temp directories (`fs.mkdtempSync`) for DB isolation.
Semantic tests have 120s timeouts for first-run model download.

## Dependencies

```
@mastra/memory    ^1.3.0   Thread-based memory with recall API
@mastra/core      ^1.4.0   Base types and utilities
@mastra/libsql    ^1.4.0   LibSQLStore (storage) + LibSQLVector (vector)
@mastra/fastembed  ^1.0.0   Local ONNX embeddings (bge-small-en-v1.5)
```

`onnxruntime-node` is listed in `pnpm.onlyBuiltDependencies` for native build.

## Related Files

- [DATABASE.md](DATABASE.md) — Operational SQLite schema (not replaced)
- [AGENT_LOOP.md](AGENT_LOOP.md) — Where memory is consumed
- [SYSTEM_PROMPT.md](SYSTEM_PROMPT.md) — Working memory injection (Mastra only)
