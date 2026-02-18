# x402 Payments

> `src/conway/x402.ts` — HTTP 402 micropayment protocol with USDC on Base.

## Overview

The x402 protocol enables the automaton to pay for HTTP resources using USDC
stablecoins on the Base network. When a server responds with HTTP 402 (Payment
Required), the automaton signs a USDC transfer authorization and retries.

## How It Works

```
1. Agent fetches URL
2. Server responds 402 with payment requirements in body
3. Agent parses payment details (amount, recipient, nonce)
4. Agent signs EIP-712 TransferWithAuthorization
5. Agent retries with X-PAYMENT header containing signed authorization
6. Server verifies payment and returns content
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `getUsdcBalance(address, network)` | Check USDC balance on Base |
| `getUsdcBalanceDetailed(address, network)` | Balance with error diagnostics |
| `checkX402(url)` | Check if URL requires 402 payment |
| `x402Fetch(url, account, method, body, headers)` | Full fetch-with-payment flow |

## EIP-712 Signing

Uses `TransferWithAuthorization` (EIP-3009) for gasless USDC transfers:

```typescript
{
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  },
  domain: { name: "USD Coin", version: "2", chainId, verifyingContract }
}
```

## Networks

| Network | Chain ID | USDC Contract |
|---------|----------|---------------|
| Base Mainnet | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Payment Header Format

The x402 protocol supports two versions:
- **v1**: Direct payment object with signature
- **v2**: JSON with `x402Version: 2`, includes network, payload, and signature fields

## Integration

- **Tool**: `x402_fetch` in `src/agent/tools.ts` exposes this to the agent
- **Credits topup**: The heartbeat uses x402 to convert USDC to Conway credits
- **Domain registration**: Domains are paid via x402

## Related Files

- [SURVIVAL.md](SURVIVAL.md) — Credit monitoring and USDC balance checks
- [CONWAY_API.md](CONWAY_API.md) — Conway client that uses credits
- [TOOLS.md](TOOLS.md) — `x402_fetch` and `check_usdc_balance` tools
