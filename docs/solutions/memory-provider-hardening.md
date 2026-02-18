---
title: Memory Provider System — Review & Hardening
date: 2026-02-18
category: security-and-architecture
tags:
  - memory-providers
  - injection-defense
  - backward-compatibility
  - dual-write
  - code-quality
severity: medium
components:
  - src/memory/mastra/index.ts
  - src/memory/legacy/index.ts
  - src/agent/loop.ts
  - src/agent/system-prompt.ts
status: resolved
---

# Memory Provider System — Review & Hardening

## Problem

After implementing a pluggable memory provider system (legacy SQLite + Mastra
with semantic recall), a 4-agent code review found 19 issues across security,
architecture, simplicity, and performance. 18 were fixed in parallel; 1 was
deferred by design (registry simplification — kept for future A/B testing).

## What Was Built

- `MemoryProvider` interface with 2 backends (legacy SQLite, Mastra with fastembed)
- `--memory <name>` CLI flag for provider selection
- Semantic vector search over past turns (Mastra)
- Structured working memory injected into system prompt (Mastra)
- 32 tests across 4 test files

## Issues Found & Fixed

### Security (7 issues)

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| SEC-02 | P1 | Working memory injected into prompt unsanitized | `sanitizeWorkingMemory()`: delimiter stripping + 4000-char truncation |
| SEC-03 | P2 | DB paths default to CWD | Changed to `~/.automaton/` via `os.homedir()` |
| SEC-04 | P2 | Race condition on `onWake()` thread ID | Added `if (this.currentThreadId) return` guard |
| SEC-05 | P2 | 4 silent `catch {}` blocks | Added `console.warn` logging to 3, documented the 4th |
| SEC-06 | P3 | `any[]` message construction | Created typed `MastraMessage` interface |
| SEC-07 | P3 | `JSON.stringify` fallback leaks structure | Replaced with `"[unrecognized content format]"` |

### Architecture (3 issues)

| Severity | Issue | Fix |
|----------|-------|-----|
| P1 | CLI shows empty turns for Mastra | Dual-write: loop always writes to SQLite, then calls `memory.saveTurn()` |
| P3 | Thread ID uses non-ULID format | Changed to `wake-${ulid()}` |
| P3 | Unused `MemoryProvider` import in index.ts | Removed |

### Code Quality (4 issues)

| Severity | Issue | Fix |
|----------|-------|-----|
| P2 | `context.ts` deprecation shim unused | Deleted file (verified zero imports) |
| P3 | `createTestTurn()` duplicated in 2 test files | Extracted to shared `mocks.ts` |
| P3 | `mastra-semantic-disabled.test.ts` overlaps | Merged unique test, deleted file |
| P3 | Redundant `config` field in MastraMemoryProvider | Removed (kept param for backward compat) |

### Deferred

| Issue | Reason |
|-------|--------|
| Registry.ts simplification | Kept for future A/B testing of providers |
| Unbounded embeddingCache | Inside `@mastra/memory`, not our code |
| Per-turn DDL round-trips | Inside `@mastra/memory`, not our code |

## 9 Reusable Patterns

See [docs/MEMORY_HARDENING_PATTERNS.md](../MEMORY_HARDENING_PATTERNS.md) for
detailed pattern documentation. Summary:

| Pattern | Principle |
|---------|-----------|
| Sanitize dynamic prompt content | Strip delimiters, truncate length |
| Dual-write during backend migration | Old consumers keep reading old backend |
| Safe file path defaults | `os.homedir()`, never CWD |
| Observable error handling | `console.warn` unless explicitly non-critical |
| Type safety at boundaries | Typed interfaces even when API accepts `any` |
| Idempotent lifecycle methods | Guard against re-entry |
| Standard ID formats | Use project convention (ULID) everywhere |
| Ruthless dead code cleanup | Delete shims immediately after refactor |
| Centralized test helpers | Shared `mocks.ts` from the start |

## Verification

- 32 tests passing (4 heartbeat, 6 loop, 16 mastra-memory, 6 mastra-semantic)
- All 4 docs updated (MEMORY.md, SECURITY.md, AGENT_LOOP.md, CLAUDE.md)

## Related Documentation

- [docs/MEMORY.md](../MEMORY.md) — Full memory system architecture
- [docs/SECURITY.md](../SECURITY.md) — Defense in depth including working memory sanitization
- [docs/AGENT_LOOP.md](../AGENT_LOOP.md) — Turn lifecycle with dual-write
- [docs/MEMORY_HARDENING_PATTERNS.md](../MEMORY_HARDENING_PATTERNS.md) — Reusable patterns
- [CLAUDE.md](../../CLAUDE.md) — Repository map with memory module
