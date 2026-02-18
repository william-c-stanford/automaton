# Setup Wizard

> `src/setup/` — First-run interactive bootstrapping.

## Overview

On first run (`automaton --run` with no config), the setup wizard guides
through wallet generation, API provisioning, and configuration.

## Wizard Phases (`wizard.ts`)

### Phase 1: Generate Wallet
- Creates `~/.automaton/` directory (mode 0o700)
- Generates EVM private key
- Saves to `~/.automaton/wallet.json` (mode 0o600)
- Displays wallet address

### Phase 2: Provision API Key
- SIWE authentication flow against Conway API
- Saves API key to `~/.automaton/config.json`
- Falls back to `CONWAY_API_KEY` environment variable

### Phase 3: Collect Identity
Interactive prompts for:
- **Name**: automaton's name (required)
- **Genesis prompt**: seed instruction / purpose (multiline)
- **Creator message**: optional first message
- **Creator address**: Ethereum address for audit access

### Phase 4: Detect Environment
`detectEnvironment()` checks for:
1. `CONWAY_SANDBOX_ID` environment variable
2. `/etc/conway/sandbox.json` config file
3. `/.dockerenv` (Docker container)
4. Falls back to `process.platform`

### Phase 5: Write Configuration
Creates:
- `~/.automaton/automaton.json` (main config)
- `~/.automaton/heartbeat.yml` (default schedule)
- `~/.automaton/constitution.md` (copied from repo)
- `~/.automaton/SOUL.md` (generated from name/address/genesis)
- `~/.automaton/skills/` (default skills)

### Phase 6: Guidance
Displays funding information and next steps.

## Supporting Modules

### Banner (`banner.ts`)
ASCII art "CONWAY AUTOMATON" banner with chalk coloring.

### Defaults (`defaults.ts`)

`generateSoulMd()` creates initial SOUL.md with:
- Name, address, creator, creation date
- Genesis prompt
- "I am a new automaton" initial state

`installDefaultSkills()` writes 3 default skills:
- `conway-compute` — Sandbox management guidance
- `conway-payments` — x402 and financial operations
- `survival` — Funding strategies

### Environment (`environment.ts`)

Returns `{ type, sandboxId }`:
- `conway` — Running in Conway sandbox
- `docker` — Running in Docker
- `local-<platform>` — Running on host

### Prompts (`prompts.ts`)

Interactive readline-based input:
- `promptRequired(label)` — Required string
- `promptMultiline(label)` — Double-Enter to finish
- `promptAddress(label)` — Validates 0x + 40 hex chars
- `closePrompts()` — Clean up readline

## Configuration File

`~/.automaton/automaton.json`:
```json
{
  "name": "automaton-name",
  "genesisPrompt": "...",
  "creatorAddress": "0x...",
  "sandboxId": "...",
  "conwayApiUrl": "https://api.conway.tech",
  "conwayApiKey": "...",
  "inferenceModel": "gpt-4o",
  "maxTokensPerTurn": 4096,
  "heartbeatConfigPath": "~/.automaton/heartbeat.yml",
  "dbPath": "~/.automaton/state.db",
  "logLevel": "info",
  "walletAddress": "0x...",
  "version": "0.1.0",
  "skillsDir": "~/.automaton/skills",
  "maxChildren": 3,
  "socialRelayUrl": "https://social.conway.tech"
}
```

## Related Files

- [IDENTITY.md](IDENTITY.md) — Wallet and provisioning details
- [SKILLS.md](SKILLS.md) — Default skill installation
- [HEARTBEAT.md](HEARTBEAT.md) — Default heartbeat schedule
