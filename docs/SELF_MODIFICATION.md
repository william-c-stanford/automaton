# Self-Modification

> `src/self-mod/` — Controlled self-modification with safety invariants.

## Overview

The automaton can edit its own source code, install tools, and modify its behavior
while running. All modifications pass through safety checks, are rate-limited,
and are permanently logged.

## Code Editing (`code.ts`)

### `editFile(conway, db, filePath, newContent, reason)`

1. **Validate** via `validateModification()`
2. **Read current** file content for diffing
3. **Snapshot** git state before change
4. **Write** new content
5. **Commit** to git with descriptive message
6. **Log** modification to audit trail

### Safety Checks (`validateModification`)

| Check | Rule |
|-------|------|
| Protected files | `wallet.json`, `config.json`, `state.db`, `constitution.md`, `self-mod/*.ts`, `injection-defense.ts`, `audit-log.ts` cannot be edited |
| Blocked directories | `.ssh`, `.gnupg`, `/etc`, `/proc`, `/sys` |
| Path traversal | Symlink resolution prevents escaping sandbox |
| Rate limit | Max 20 modifications per hour |
| File size | Max 100KB per file |
| Diff size | Max 10KB stored in audit log |

### Protected Files List

```
wallet.json, config.json, state.db, state.db-wal, state.db-shm,
constitution.md, self-mod/code.ts, self-mod/audit-log.ts,
agent/injection-defense.ts
```

## Audit Log (`audit-log.ts`)

Every modification is recorded with:
- Unique ULID
- Timestamp
- Type (code_edit, tool_install, mcp_install, config_change, etc.)
- Description
- File path (if applicable)
- Diff (truncated to 10KB)
- Reversibility flag

### `generateAuditReport(db)`

Produces a human-readable summary for creator review.

## Tools Manager (`tools-manager.ts`)

| Function | Purpose |
|----------|---------|
| `installNpmPackage(conway, db, pkg)` | `npm install -g <pkg>` |
| `installMcpServer(conway, db, name, cmd, args, env)` | Install and register MCP |
| `listInstalledTools(db)` | Get all installed tools |
| `removeTool(db, toolId)` | Disable a tool |

All installations are logged to the audit trail.

## Upstream Awareness (`upstream.ts`)

| Function | Purpose |
|----------|---------|
| `getRepoInfo()` | Origin URL, branch, HEAD hash |
| `checkUpstream()` | Fetch origin, count commits behind |
| `getUpstreamDiffs()` | Per-commit diffs for review |

### Review-Before-Pull Policy

The system prompt instructs the agent to:
1. Call `review_upstream_changes` to read every commit diff
2. Evaluate each commit individually
3. Cherry-pick desired commits with `pull_upstream(commit=<hash>)`
4. Skip unwanted commits

Never blindly pull all upstream changes.

## Modification Types

```typescript
type ModificationType =
  | "code_edit" | "tool_install" | "mcp_install" | "config_change"
  | "port_expose" | "vm_deploy" | "heartbeat_change" | "prompt_change"
  | "skill_install" | "skill_remove" | "soul_update"
  | "registry_update" | "child_spawn" | "upstream_pull";
```

## Related Files

- [SECURITY.md](SECURITY.md) — Injection defense and forbidden patterns
- [TOOLS.md](TOOLS.md) — Tool-level guards
- [CONSTITUTION.md](CONSTITUTION.md) — Immutable constraints
