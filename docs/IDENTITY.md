# Identity & Wallet

> `src/identity/` — EVM wallet generation and SIWE API provisioning.

## Overview

The automaton's identity is its Ethereum wallet. The private key is the automaton.
API access is provisioned via Sign-In With Ethereum (SIWE).

## Wallet (`wallet.ts`)

### Storage
- Path: `~/.automaton/wallet.json`
- Permissions: `0o600` (owner read/write only)
- Contents: `{ privateKey: "0x...", createdAt: "ISO timestamp" }`

### Key Functions

| Function | Purpose |
|----------|---------|
| `getWallet()` | Load existing or generate new wallet. Returns `{ account, isNew }` |
| `getWalletAddress()` | Quick address lookup |
| `loadWalletAccount()` | Load full `PrivateKeyAccount` from viem |
| `walletExists()` | Check if wallet.json exists |
| `getAutomatonDir()` | Returns `~/.automaton` path |

### Generation
New wallets are created via `viem/accounts`:
1. `generatePrivateKey()` creates a random key
2. `privateKeyToAccount()` derives the account
3. Key is written to disk with restricted permissions

## Provisioning (`provision.ts`)

### SIWE Flow

```
1. GET /v1/auth/nonce              -> nonce
2. Create SiweMessage               -> domain, address, statement, nonce, chainId
3. Sign message with wallet          -> signature
4. POST /v1/auth/siwe/verify         -> JWT
5. POST /v1/auth/api-keys/create     -> { apiKey, keyPrefix }
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `provision(apiUrl?)` | Full SIWE flow, saves API key to config.json |
| `loadApiKeyFromConfig()` | Load cached key from `~/.automaton/config.json` |
| `registerParent(creatorAddress, apiUrl?)` | Register creator for audit access |

### API Key Storage
The API key is saved in two places:
- `~/.automaton/config.json` as `{ apiKey: "..." }`
- `automaton.json` as `conwayApiKey`

## Protected Files

Both `wallet.json` and related identity files are in the `PROTECTED_FILES` list
in `src/self-mod/code.ts`. The automaton cannot modify its own wallet or credentials.

## Related Files

- [SECURITY.md](SECURITY.md) — Self-preservation guards
- [REGISTRY.md](REGISTRY.md) — On-chain identity registration
- [SETUP.md](SETUP.md) — Initial wallet generation
