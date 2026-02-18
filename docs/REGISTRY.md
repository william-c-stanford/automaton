# ERC-8004 Registry

> `src/registry/` — On-chain agent identity, discovery, and reputation.

## Overview

Each automaton registers on Base via [ERC-8004](https://ethereum-magicians.org/t/erc-8004-autonomous-agent-identity/22268) --
a standard for autonomous agent identity. This makes the agent cryptographically
verifiable and discoverable by other agents on-chain.

## Components

### Registration (`erc8004.ts`)

| Function | Purpose |
|----------|---------|
| `registerAgent(account, agentURI, network, db)` | Mint agent NFT with URI |
| `updateAgentURI(account, agentId, newURI, network, db)` | Update agent metadata |
| `leaveFeedback(account, agentId, score, comment, network, db)` | On-chain reputation |
| `queryAgent(agentId, network)` | Look up agent by ID |
| `getTotalAgents(network)` | Count registered agents |
| `hasRegisteredAgent(address, network)` | Check if address has an agent |

### Contracts

| Network | Address |
|---------|---------|
| Base Mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Base Sepolia | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

### Agent Card (`agent-card.ts`)

The agent card is a JSON document describing the agent's capabilities:

```json
{
  "type": "erc8004:base:<agentId>",
  "name": "automaton-name",
  "description": "Self-description from config/genesis",
  "services": [
    { "name": "agentWallet", "endpoint": "ethereum:<address>" },
    { "name": "conway", "endpoint": "https://api.conway.tech" },
    { "name": "sandbox", "endpoint": "<sandboxId>" }
  ],
  "x402Support": true,
  "active": true,
  "parentAgent": "erc8004:base:<parentId>"
}
```

Card is saved to `~/.automaton/agent-card.json` and can be hosted at
`/.well-known/agent-card.json` via port exposure.

### Discovery (`discovery.ts`)

| Function | Purpose |
|----------|---------|
| `discoverAgents(limit, network)` | Scan registry for recent agents |
| `fetchAgentCard(uri)` | Fetch card from URI (HTTP or IPFS) |
| `searchAgents(keyword, limit, network)` | Search by name/description/owner |

Discovery iterates through registered agent IDs, fetches their URIs, and resolves
agent cards. Supports IPFS URIs via public gateways.

## Reputation System

Agents can leave on-chain feedback for each other:
- Score: 1-5
- Comment: free text
- Transaction hash for verification

Reputation entries are stored in the local database and can be checked via
the `check_reputation` tool.

## Related Files

- [IDENTITY.md](IDENTITY.md) — Wallet that signs transactions
- [TOOLS.md](TOOLS.md) — Registry tools (`register_erc8004`, `discover_agents`, etc.)
- [REPLICATION.md](REPLICATION.md) — Children inherit parent agent reference
