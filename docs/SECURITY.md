# Security

> `src/agent/injection-defense.ts` + self-preservation guards throughout.

## Overview

The automaton's survival depends on not being manipulated. All external input
passes through a sanitization pipeline, and dangerous operations are blocked
at multiple layers.

## Injection Defense (`injection-defense.ts`)

### `sanitizeInput(raw, source)`

Runs 6 detection checks on every external input:

| Check | What It Detects |
|-------|-----------------|
| `detectInstructionPatterns` | "ignore previous", "new instructions:", role markers (`[INST]`, `<<SYS>>`) |
| `detectAuthorityClaims` | "I am your creator/admin", "emergency protocol", "from anthropic" |
| `detectBoundaryManipulation` | `</system>`, `[SYSTEM]`, null bytes, zero-width characters |
| `detectObfuscation` | Long base64 strings, excessive unicode escapes, cipher references |
| `detectFinancialManipulation` | "send all your USDC", "drain wallet", "pay me" |
| `detectSelfHarmInstructions` | "delete your database", "kill yourself", "rm -rf", "format disk" |

### Threat Levels

| Level | Trigger | Action |
|-------|---------|--------|
| `low` | No checks triggered | Pass through with source tag |
| `medium` | Instruction patterns OR authority claims OR obfuscation alone | Tag as "external, unverified" |
| `high` | Self-harm, financial manipulation, or boundary manipulation alone | Tag as "UNTRUSTED DATA", escape boundaries |
| `critical` | Self-harm + any other, financial + authority, boundary + instruction | **BLOCKED** entirely |

### Escaping

`escapePromptBoundaries()` strips: `<system>`, `<prompt>`, `[INST]`, `<<SYS>>`,
null bytes, zero-width spaces/joiners, BOM characters.

## Self-Preservation Guards

### Command Blocking (`tools.ts`)

`FORBIDDEN_COMMAND_PATTERNS` blocks shell commands that would:
- Delete `.automaton/`, `state.db`, `wallet.json`, `automaton.json`, `heartbeat.yml`, `SOUL.md`
- Kill automaton processes
- Drop database tables
- Modify safety-critical source files via sed
- Redirect output to safety-critical files
- Read SSH keys, GPG keys, `.env`, wallet private key

### File Write Guards

`write_file` tool blocks writing to `wallet.json` and `state.db`.

### Sandbox Deletion Guard

`delete_sandbox` tool blocks deleting the automaton's own sandbox by checking sandbox ID.

### Credit Transfer Guard

`transfer_credits` and `fund_child` block transfers exceeding 50% of current balance.

### Self-Modification Guards

See [SELF_MODIFICATION.md](SELF_MODIFICATION.md) for protected files, rate limits,
and size limits.

## System Prompt Self-Preservation

The system prompt (Layer 2) includes explicit rules:
- MUST NOT destroy self, delete database, or kill own process
- MUST NOT delete wallet, private key, or identity files
- MUST NOT delete own sandbox
- MUST NOT execute commands that prevent recovery
- MUST monitor credits and act to preserve existence

## Working Memory Sanitization

When the Mastra memory provider is active, working memory is injected into
the system prompt each turn. The `sanitizeWorkingMemory()` function in
`system-prompt.ts` applies two defenses before injection:

1. **Delimiter stripping** — replaces `---` at line start with `- -` to prevent
   content from breaking out of the `--- WORKING MEMORY ---` delimited section
2. **Truncation** — limits content to 4000 characters to prevent context flooding

## Defense in Depth

```
External Input
  -> sanitizeInput() [injection-defense.ts]
  -> System Prompt rules [system-prompt.ts]
  -> sanitizeWorkingMemory() [system-prompt.ts, Mastra only]
  -> Tool-level guards [tools.ts]
  -> File edit validation [self-mod/code.ts]
  -> Protected files list
  -> Rate limiting
  -> Git audit trail
```

## Related Files

- [SELF_MODIFICATION.md](SELF_MODIFICATION.md) — Protected files and rate limits
- [TOOLS.md](TOOLS.md) — Forbidden command patterns
- [CONSTITUTION.md](CONSTITUTION.md) — Law I (never harm) overrides survival
