# Memory Provider Hardening: Reusable Patterns

> Patterns and fixes applied during a pluggable memory provider system code review.
> Focus on repeatable solutions, not implementation-specific details.

## Theme 1: Prompt Injection Defense for Dynamic Content

**Problem**

Working memory (persisted scratchpad content) was injected raw into delimited sections of the 9-layer system prompt. An attacker could craft content with `---` delimiters to break section boundaries and inject arbitrary prompt instructions.

**Fix**

Added sanitization layer (`sanitizeWorkingMemory()` in system-prompt.ts):
- Strip `---` at line start (regex `/^---/gm` → `- -`) to prevent delimiter escape
- Truncate to 4000 chars to prevent context flooding

**Reusable Pattern**

Any dynamic content injected into delimited/structured prompt sections requires boundary sanitization:
- Identify the delimiter syntax (e.g., `---`, `===`, `>>`)
- Escape/remove delimiters at line starts in untrusted content
- Combine with length limits to prevent context exhaustion
- Apply this whenever user data, external APIs, or persistent storage feeds into prompt construction

---

## Theme 2: Dual-Write for Backend Migration Compatibility

**Problem**

When adding a new storage backend (Mastra memory) alongside legacy SQLite, CLI tools (`--status`, `logs`) showed zero turns because they read directly from the old backend. New turns went only to the new provider.

**Fix**

Agent loop now dual-writes every turn:
1. Write to operational SQLite (preserves CLI/dashboard compatibility)
2. Call `memory.saveTurn()` for provider-specific storage
- Legacy provider's `saveTurn()` becomes a no-op

**Reusable Pattern**

When migrating from an old storage backend to a new pluggable one:
- Do NOT abandon reads/writes from the old backend immediately
- Instead, dual-write new data to both backends during transition
- Existing consumers (CLIs, dashboards, monitoring) continue reading from old backend
- This prevents the need to update all consumers simultaneously
- Legacy provider should gracefully accept writes without storing (interface contract is met, backward compat preserved)
- Once all consumers are migrated, old backend writes can be removed

---

## Theme 3: Safe Defaults for File Paths

**Problem**

Default database paths were hardcoded as relative paths (`"file:./memory.db"`), resolving relative to CWD. Users running commands from different directories would create scattered DB files across the filesystem.

**Fix**

Changed defaults to use well-known directory:
```typescript
path.join(os.homedir(), ".automaton", "memory.db")
```

**Reusable Pattern**

File-based storage should never default to CWD:
- Always resolve to a well-known location: `~/.appname/`, `~/.config/appname/`, or `$XDG_DATA_HOME/appname/`
- Use `os.homedir()` + `path.join()` for cross-platform paths
- Document the location in help text and error messages
- For debugging, log the resolved absolute path on startup
- Consider env var overrides for advanced users: `APPNAME_DB_PATH`

---

## Theme 4: Observable Error Handling

**Problem**

Four empty `catch {}` blocks silently swallowed errors in:
- Thread creation
- Message saving
- Memory recall
Failures were invisible to operators, making bugs difficult to diagnose.

**Fix**

Added `console.warn("[mastra] operation failed:", err.message)` to 3 of 4 catch blocks:
- Kept one silent for a non-critical path (first-call working memory fetch) with explanatory comment

**Reusable Pattern**

Silent error handling is acceptable only for truly non-critical operations. For all others:
- Log at minimum: `console.warn("[component] operation failed:", err.message)`
- Include operation context: `"thread creation"`, `"message save"`, etc.
- Make silence explicit: comment explaining why this failure is safe to ignore
- Example:
  ```typescript
  try {
    await criticalOp();
  } catch (err) {
    // Non-fatal: working memory absent on first startup
    console.warn("[mastra] failed to fetch working memory:", err.message);
  }
  ```
- Avoid logging entire error objects (can leak internal structure); extract `.message`

---

## Theme 5: Type Safety at System Boundaries

**Problem**

Messages were constructed as `any[]` or passed as untyped data. A fallback `JSON.stringify()` could leak internal object structure to downstream APIs.

**Fix**

Created typed `MastraMessage` interface:
```typescript
interface MastraMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
```
Replaced fallback serialization with safe default: `"[unrecognized content format]"`

**Reusable Pattern**

Even when downstream APIs accept `any`, maintain type safety at boundaries:
- Define explicit interfaces for message/data structures (e.g., `MastraMessage`, `MemoryTurn`)
- Avoid `any` in internal code; use discriminated unions if flexibility is needed
- Fallback serialization should never expose raw internals:
  - Bad: `JSON.stringify(unknownObject)` → may leak private fields
  - Good: `"[unrecognized content format]"` or `"<error: unsupported type>"`
- Type safety catches mistakes during review and refactoring

---

## Theme 6: Concurrent Access Guards

**Problem**

If `onWake()` (lifecycle hook) was called twice concurrently, the second call would overwrite the thread ID. Messages saved to the first thread would be orphaned.

**Fix**

Added re-entrance guard at method start:
```typescript
if (this.currentThreadId) return;
```

**Reusable Pattern**

State-mutating lifecycle methods should be idempotent:
- Guard against re-entry with early return: `if (this.state) return;`
- For async methods, consider a Promise flag: `if (this.initPromise) return this.initPromise;`
- Document the idempotency: `// Safe to call multiple times`
- Test with concurrent calls: `await Promise.all([onWake(), onWake()])`
- If true locking is needed (rare), use a library like `async-lock`

---

## Theme 7: Standard ID Formats

**Problem**

Thread IDs used ad-hoc format: `wake-${Date.now()}-${random}`. Non-sortable, non-standard, increases cognitive load.

**Fix**

Changed to use project's standard ULID format:
```typescript
`wake-${ulid()}`
```

**Reusable Pattern**

Use the project's established ID format for ALL new identifiers:
- If the project already uses ULIDs, use them everywhere: `ulid()`
- If UUIDs: `crypto.randomUUID()` or `uuid()`
- Avoid ad-hoc formats: `wake-${Date.now()}-${Math.random()}`, `user_${counter}`, etc.
- Benefits: sortable, collision-resistant, consistent grep-ability, easier debugging
- Document the format in code: `// Thread IDs use ULID format: wake-01ARZ3NDEKTSV4RRFFQ`
- Enforce in code review: any new ID generation should match project conventions

---

## Theme 8: Dead Code Elimination

**Problem**

After refactoring the memory provider:
- `src/agent/context.ts` was a 10-line re-export shim with no actual imports
- `MemoryProvider` type was imported in index.ts but never used
Dead code creates false complexity and confuses future maintainers.

**Fix**

- Deleted context.ts entirely (verified zero imports via grep)
- Removed unused MemoryProvider import
- Ran full build to confirm no hidden dependencies

**Reusable Pattern**

After any refactor, immediately clean up:
1. Grep for imports of deprecated modules: `grep -r "from.*context" src/`
2. If count is zero, delete the file
3. Scan for unused imports in files that touch the refactored code
4. Remove unused types/functions
5. Run full build and tests to confirm
6. Never leave "backward compatibility shims" — either it's used or it's deleted
7. Large codebases accumulate dead code quickly; cleanup is a habit, not a later task

---

## Theme 9: Test Helper Consolidation

**Problem**

Test utilities were scattered and duplicated:
- `createTestTurn()` copy-pasted identically in 2 test files
- Separate `mastra-semantic-disabled.test.ts` duplicated tests already in `mastra-memory.test.ts`
- Any change to the helper required updates in multiple places

**Fix**

- Extracted `createTestTurn()` to shared `mocks.ts`
- Merged unique tests from semantic-disabled file into main test
- Deleted redundant test file
- Single source of truth for test fixtures

**Reusable Pattern**

Test infrastructure should be centralized from the start:
1. Create a `test/mocks.ts` or `__mocks__/` directory early
2. Put all test helpers, factories, and fixtures there: `createTestTurn()`, `mockProvider()`, etc.
3. When you copy-paste a test helper between files, that's a sign to consolidate
4. When test files have overlapping coverage, merge them (one file per logical concept, not one per disabled feature)
5. Share mocks via export: `export function createTestTurn(...): Turn { ... }`
6. Benefits:
   - Single source of truth for test data structures
   - Consistent test setup across suites
   - Easier to evolve test infrastructure without ripple effects
   - Simpler to debug (one place to look)

---

## Summary: Cross-Cutting Principles

These 9 themes share common principles applicable beyond memory systems:

| Principle | Themes | Application |
|-----------|--------|-------------|
| **Defense-in-depth** | 1, 5 | Sanitize at boundaries, type-check at interfaces, never trust external input |
| **Backward compat during migration** | 2, 8 | Dual-write, keep shims only if used, migrate consumers before deleting |
| **Explicit over implicit** | 3, 4 | Safe defaults, visible error handling, documented idempotency |
| **Project consistency** | 7, 9 | Use established formats (IDs, test helpers), don't invent local conventions |
| **Prevent concurrent surprises** | 6 | Guard lifecycle methods, test concurrent calls, document assumptions |
| **Ruthless cleanup** | 8 | Delete dead code immediately, don't defer; unused imports are lint failures waiting to happen |

