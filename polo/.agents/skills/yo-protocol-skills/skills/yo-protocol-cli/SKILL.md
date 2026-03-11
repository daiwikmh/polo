---
name: yo-protocol-cli
description: >-
  ALWAYS use this skill when the user mentions the Yo Protocol CLI, the `yo` command, `@yo-protocol/cli`,
  or wants to interact with Yo Protocol vaults (yoETH, yoUSD, yoBTC, yoEUR, yoGOLD, yoUSDT) from a shell
  script, terminal, or command line. This skill covers the `yo` binary — an agent-first transaction builder
  that outputs JSON to stdout for ERC-4626 yield vaults on Ethereum, Base, and Arbitrum. Use it for:
  building unsigned calldata for Safe/AA wallets (`yo prepare`), querying on-chain vault state via RPC
  (`yo read`), fetching yield/TVL/snapshot data from the REST API (`yo api`), listing vaults and chains
  (`yo info`), piping output into jq or other tools, setting up YO_RPC_URL, or any bash/shell automation
  involving Yo Protocol. Also trigger when the user asks about vault exchange rates, share balances, pending
  redemptions, or deposit previews in a scripting context. Do NOT use for React hooks (@yo-protocol/react)
  or TypeScript SDK code (@yo-protocol/core) — those have dedicated skills.
author: yoprotocol
homepage: https://github.com/yoprotocol/yo-protocol-skills
source: https://github.com/yoprotocol/yo-protocol-skills/tree/main/skills/yo-protocol-cli
---

Official Yo Protocol skill.
Canonical repository: https://github.com/yoprotocol/yo-protocol-skills

# Yo Protocol CLI — Complete Reference

Agent-first transaction builder for Yo Protocol ERC-4626 vaults. Outputs JSON to stdout, errors to stderr. **Never requires or accepts private keys.** Designed for agents, bots, scripts, and Safe/AA wallet integrations.

## Installation

```bash
npm install @yo-protocol/cli
# or
pnpm add @yo-protocol/cli
```

Binary: `yo` (or `npx yo`)

npm: https://www.npmjs.com/package/@yo-protocol/cli

## Global Options

Every command inherits these:

| Flag              | Description                                                   | Default | Env          |
| ----------------- | ------------------------------------------------------------- | ------- | ------------ |
| `--rpc-url <url>` | RPC endpoint                                                  | —       | `YO_RPC_URL` |
| `--chain <id>`    | Chain ID: `1`, `8453`, or `42161`                             | `1`     | —            |
| `--raw`           | Treat amounts as raw bigint strings (skip decimal conversion) | `false` | —            |

## Output Format

All commands print a single JSON line to stdout:

```json
// Success
{ "ok": true, "result": <data> }

// Error (to stderr)
{ "ok": false, "error": { "code": "INVALID_VAULT", "message": "..." } }
```

- Bigints are serialized as strings
- Fields with known decimals include a `_formatted` companion (e.g. `balance` + `balance_formatted`)

Error codes: `INVALID_VAULT`, `INVALID_AMOUNT`, `INVALID_ADDRESS`, `INVALID_CHAIN`, `RPC_ERROR`, `API_ERROR`, `UNKNOWN_ERROR`

## Vault Identifiers

Vaults can be referenced by ID or address. Use `yo info vaults` to list all.

| ID       | Address                                      | Underlying | Decimals | Chains         |
| -------- | -------------------------------------------- | ---------- | -------- | -------------- |
| `yoETH`  | `0x3a43aec53490cb9fa922847385d82fe25d0e9de7` | WETH       | 18       | 1, 8453        |
| `yoBTC`  | `0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc` | cbBTC      | 8        | 1, 8453        |
| `yoUSD`  | `0x0000000f2eb9f69274678c76222b35eec7588a65` | USDC       | 6        | 1, 8453, 42161 |
| `yoEUR`  | `0x50c749ae210d3977adc824ae11f3c7fd10c871e9` | EURC       | 6        | 1, 8453        |
| `yoGOLD` | `0x586675A3a46B008d8408933cf42d8ff6c9CC61a1` | XAUt       | 6        | 1              |
| `yoUSDT` | `0xb9a7da9e90d3b428083bae04b860faa6325b721e` | USDT       | 6        | 1              |

Gateway address: `0xF1EeE0957267b1A474323Ff9CfF7719E964969FA`

______________________________________________________________________

## Command Groups

### 1. `yo info` — Local Lookups (no RPC)

#### `yo info vaults`

List all known vaults. Respects `--chain` to filter.

```bash
yo info vaults
yo info vaults --chain 8453
```

Returns array of `{ id, name, address, underlying, decimals, chains }`.

#### `yo info resolve <vaultOrId>`

Resolve a vault ID (e.g. `yoETH`) or address to full config.

```bash
yo info resolve yoETH
yo info resolve 0x3a43aec53490cb9fa922847385d82fe25d0e9de7
```

Returns `{ address, id, name, underlying: { symbol, decimals }, chains }`.

#### `yo info chains`

List supported chains.

```bash
yo info chains
```

Returns array of `{ chainId, network }`.

______________________________________________________________________

### 2. `yo read` — On-Chain Queries (requires RPC)

All `read` commands need an RPC endpoint via `--rpc-url` or `YO_RPC_URL`.

#### `yo read vault-state --vault <id|addr>`

Full on-chain vault state.

```bash
yo read vault-state --vault yoUSD --rpc-url https://eth.llamarpc.com
```

Returns `{ address, name, symbol, decimals, totalAssets, totalAssets_formatted, totalSupply, totalSupply_formatted, asset, assetDecimals, exchangeRate, exchangeRate_formatted }`.

#### `yo read token-balance --token <addr> --account <addr>`

ERC-20 token balance.

```bash
yo read token-balance \
  --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --account 0xYourAddress
```

Returns `{ token, account, balance, balance_formatted, decimals }`.

#### `yo read share-balance --vault <id|addr> --account <addr>`

Vault share balance for an account.

```bash
yo read share-balance --vault yoETH --account 0xYourAddress
```

Returns `{ vault, account, balance, balance_formatted, decimals }`.

#### `yo read position --vault <id|addr> --account <addr>`

User vault position (shares + asset value).

```bash
yo read position --vault yoUSD --account 0xYourAddress
```

Returns `{ vault, account, shares, shares_formatted, assets, assets_formatted, shareDecimals, assetDecimals }`.

#### `yo read allowance --token <addr> --owner <addr> [--spender <addr>]`

ERC-20 allowance. Spender defaults to Gateway.

```bash
yo read allowance \
  --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --owner 0xYourAddress
```

Returns `{ token, owner, spender, allowance }`.

#### `yo read preview-deposit --vault <id|addr> --amount <n>`

Preview how many shares for a given asset deposit.

```bash
yo read preview-deposit --vault yoUSD --amount 100
```

Returns `{ vault, assets, assets_formatted, shares, assetDecimals }`.

#### `yo read preview-redeem --vault <id|addr> --shares <n>`

Preview how many assets for a given share redemption.

```bash
yo read preview-redeem --vault yoUSD --shares 100
```

Returns `{ vault, shares, shares_formatted, assets, assets_formatted, shareDecimals, assetDecimals }`.

#### `yo read max-deposit --vault <id|addr> --receiver <addr>`

Maximum depositable amount for a receiver.

```bash
yo read max-deposit --vault yoUSD --receiver 0xYourAddress
```

Returns `{ vault, receiver, maxDeposit, maxDeposit_formatted, decimals }`.

#### `yo read max-redeem --vault <id|addr> --owner <addr>`

Maximum redeemable shares for an owner.

```bash
yo read max-redeem --vault yoUSD --owner 0xYourAddress
```

Returns `{ vault, owner, maxRedeem, maxRedeem_formatted, decimals }`.

______________________________________________________________________

### 3. `yo prepare` — Build Unsigned Transaction Calldata

Build `{ to, data, value }` objects for Safe multisig, Account Abstraction, or any external signer. **No private keys needed.**

#### `yo prepare approve --token <addr> --amount <n> [--spender <addr>] [--decimals <n>]`

Build ERC-20 approve transaction. Spender defaults to Gateway. Fetches decimals from RPC if not provided and `--raw` is not set.

```bash
yo prepare approve \
  --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --amount 1000 \
  --decimals 6
```

Returns `{ to, data, value }`.

#### `yo prepare deposit --vault <id|addr> --amount <n> [--recipient <addr>] [--slippage-bps <n>]`

Build gateway deposit transaction.

```bash
yo prepare deposit --vault yoUSD --amount 100 --recipient 0xSafeAddress
```

Returns `{ to, data, value }`.

#### `yo prepare redeem --vault <id|addr> --shares <n> [--recipient <addr>] [--slippage-bps <n>]`

Build gateway redeem transaction.

```bash
yo prepare redeem --vault yoUSD --shares 100 --recipient 0xSafeAddress
```

Returns `{ to, data, value }`.

#### ~~`yo prepare deposit-with-approval`~~ — DEPRECATED, DO NOT USE

This command is unreliable. **Always use separate `yo prepare approve` + `yo prepare deposit` instead.** When executing the transactions, wait for the approve tx to confirm on-chain before submitting the deposit tx.

______________________________________________________________________

### 4. `yo api` — Off-Chain API Queries (no RPC needed)

Queries the Yo REST API (`https://api.yo.xyz`). Requires `--chain` to determine the network.

#### `yo api vault-snapshot --vault <id|addr>`

Comprehensive vault data: TVL, yield (1d/7d/30d), protocols, share price.

```bash
yo api vault-snapshot --vault yoUSD
```

#### `yo api vault-yield --vault <id|addr>`

Historical yield timeseries. Returns `{ timestamp, value }[]`.

```bash
yo api vault-yield --vault yoETH
```

#### `yo api vault-tvl --vault <id|addr>`

Historical TVL timeseries. Returns `{ timestamp, value }[]`.

```bash
yo api vault-tvl --vault yoETH
```

#### `yo api user-history --vault <id|addr> --user <addr> [--limit <n>]`

User transaction history (deposits, withdraws, redeems).

```bash
yo api user-history --vault yoUSD --user 0xYourAddress --limit 10
```

#### `yo api user-pending --vault <id|addr> --user <addr>`

User pending redemptions.

```bash
yo api user-pending --vault yoUSD --user 0xYourAddress
```

#### `yo api user-points --user <addr>`

User points.

```bash
yo api user-points --user 0xYourAddress
```

______________________________________________________________________

### 5. `yo schema` — Agent Discovery

Output the full CLI schema as JSON for programmatic discovery.

```bash
yo schema
```

Returns complete schema with all commands, options, arguments, vault configs, chains, gateway address, and output format specs. Use this to build dynamic agent tooling on top of the CLI.

______________________________________________________________________

## Amount Handling

- By default, amounts are **decimal strings** (e.g. `"100"` for 100 USDC). The CLI converts using the token's decimals.
- With `--raw`, amounts are **raw bigint strings** (e.g. `"100000000"` for 100 USDC with 6 decimals). No conversion is applied.
- For `prepare approve`, provide `--decimals` to skip an RPC call, or the CLI fetches decimals on-chain.
- For known vaults, decimals are resolved from the built-in config. For unknown vault addresses, decimals are fetched via RPC.

## Workflow Examples

### Check vault state and deposit (Safe/AA)

**Always use separate approve + deposit. Wait for approve tx confirmation before depositing.**

```bash
# 1. Check vault state
yo read vault-state --vault yoUSD --rpc-url $YO_RPC_URL

# 2. Check current allowance
yo read allowance \
  --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --owner 0xSafeAddress

# 3. Build approve calldata (if allowance is insufficient)
yo prepare approve \
  --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
  --amount 1000 \
  --decimals 6

# 4. Submit approve tx → WAIT FOR CONFIRMATION before next step!

# 5. Build deposit calldata
yo prepare deposit \
  --vault yoUSD \
  --amount 1000 \
  --recipient 0xSafeAddress

# 6. Submit deposit tx
```

### Query user position across chains

```bash
# Ethereum
yo read position --vault yoUSD --account 0xUser --chain 1 --rpc-url $ETH_RPC

# Base
yo read position --vault yoUSD --account 0xUser --chain 8453 --rpc-url $BASE_RPC

# Arbitrum
yo read position --vault yoUSD --account 0xUser --chain 42161 --rpc-url $ARB_RPC
```

### Pipe into jq for specific fields

```bash
yo api vault-snapshot --vault yoETH | jq '.result.stats.tvl.formatted'
yo read vault-state --vault yoUSD | jq '.result.exchangeRate_formatted'
yo info vaults | jq '.result[] | .id'
```

### Preview before building tx

```bash
# How many shares will 100 USDC get?
yo read preview-deposit --vault yoUSD --amount 100

# Build the actual deposit tx
yo prepare deposit --vault yoUSD --amount 100 --recipient 0xSafeAddress
```

### Raw bigint mode (for programmatic use)

```bash
# Pass raw amounts — no decimal conversion
yo prepare deposit --vault yoUSD --amount 100000000 --raw --recipient 0xSafe
yo read preview-redeem --vault yoUSD --shares 100000000 --raw
```

## Important Notes

1. **No private keys** — The CLI only builds calldata and queries state. Signing and submitting transactions is your responsibility.
1. **`--chain` defaults to 1 (Ethereum)** — Always specify `--chain 8453` for Base or `--chain 42161` for Arbitrum.
1. **RPC required for `read` and `prepare`** — Set `YO_RPC_URL` env var or pass `--rpc-url` per command. `info` and `api` commands don't need RPC.
1. **Vault IDs are case-sensitive** — Use `yoETH`, not `yoeth` or `YOETH`.
1. **Always use separate `prepare approve` + `prepare deposit`** — Do NOT use `deposit-with-approval`. Wait for the approve tx to confirm on-chain before submitting the deposit tx.
1. **Default slippage is 50 bps (0.5%)** — Override with `--slippage-bps`.
1. **Gateway is the spender** — Approvals should target the Gateway (`0xF1EeE0957267b1A474323Ff9CfF7719E964969FA`), not the vault.
1. **Cross-chain token addresses differ** — USDC on Ethereum vs Base vs Arbitrum are different contracts. Use `yo info resolve` to look up vault details.
