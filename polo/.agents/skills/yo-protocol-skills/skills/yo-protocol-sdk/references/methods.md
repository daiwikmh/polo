# SDK Method Reference

## Table of Contents

- [Vault Reads (on-chain)](#vault-reads-on-chain)
- [User Reads (on-chain)](#user-reads-on-chain)
- [Prepared Transactions](#prepared-transactions)
- [Gateway Quote Helpers](#gateway-quote-helpers)
- [Gateway Allowance Helpers](#gateway-allowance-helpers)
- [REST API Methods](#rest-api-methods)
- [Merkl Reward Methods](#merkl-reward-methods)
- [Transaction Helpers](#transaction-helpers)
- [Utilities](#utilities)

______________________________________________________________________

## Vault Reads (on-chain)

### `getVaults(): VaultConfig[]`

Return known vault configs for the client's chain. No RPC call.

### `getVaultState(vault: Address): Promise<VaultState>`

Full on-chain vault state: name, symbol, decimals, totalAssets, totalSupply, asset address, exchangeRate.

### `previewDeposit(vault: Address, assets: bigint): Promise<bigint>`

ERC-4626 `previewDeposit` — how many shares for a given asset amount.

### `previewRedeem(vault: Address, shares: bigint): Promise<bigint>`

ERC-4626 `previewRedeem` — how many assets for a given share amount.

### `convertToAssets(vault: Address, shares: bigint): Promise<bigint>`

ERC-4626 `convertToAssets` — share-to-asset conversion without fees.

### `convertToShares(vault: Address, assets: bigint): Promise<bigint>`

ERC-4626 `convertToShares` — asset-to-share conversion without fees.

### `isPaused(vault: Address): Promise<boolean>`

Check if vault deposits are paused.

### `getIdleBalance(vault: Address): Promise<bigint>`

Get vault's idle (uninvested) balance.

______________________________________________________________________

## User Reads (on-chain)

### `getTokenBalance(token: Address, account: Address): Promise<TokenBalance>`

ERC-20 balance. Returns `{ token, balance, decimals }`.

### `getShareBalance(vault: Address, account: Address): Promise<bigint>`

User's vault share balance (raw bigint).

### `getUserPosition(vault: Address, account: Address): Promise<UserVaultPosition>`

User's position as `{ shares, assets }` — shares held and their asset value.

### `getAllowance(token: Address, owner: Address, spender: Address): Promise<TokenAllowance>`

ERC-20 allowance. Returns `{ token, owner, spender, allowance }`.

### `hasEnoughAllowance(token: Address, owner: Address, spender: Address, amount: bigint): Promise<boolean>`

Check if allowance >= amount.

### `getUserPositionsAllChains(account: Address, vaults?: T[]): Promise<Array<{ vault: T; position: UserVaultPosition }>>`

Multi-chain positions via multicall. Aggregates primary + secondary vault share balances.

______________________________________________________________________

## Prepared Transactions

All prepare methods return `PreparedTransaction { to: Address, data: Hex, value: bigint }`. The caller sends them via any wallet solution (wagmi, viem, ethers, Safe SDK, etc.).

### `prepareApprove(params): PreparedTransaction`

Synchronous. No RPC call. Spender defaults to `YO_GATEWAY_ADDRESS`.

```ts
params: { token: Address, spender?: Address, amount: bigint }
```

### `prepareDeposit(params): Promise<PreparedTransaction>`

Queries gateway for expected shares and applies slippage. **Requires explicit `recipient`.**

```ts
params: {
  vault: Address
  amount: bigint
  recipient: Address     // required
  slippageBps?: number   // default 50 (0.5%)
  partnerId?: number     // default from client config
  chainId?: number       // selects which PublicClient to use
}
```

### `prepareRedeem(params): Promise<PreparedTransaction>`

Queries gateway for expected assets and applies slippage. **Requires explicit `recipient`.**

```ts
params: {
  vault: Address
  shares: bigint
  recipient: Address     // required
  slippageBps?: number   // default 50
  minAssetsOut?: bigint  // override slippage calc
  partnerId?: number
  chainId?: number
}
```

### `prepareDepositWithApproval(params): Promise<PreparedTransaction[]>`

**Recommended for deposits.** Checks token allowance on-chain. Returns 1-2 transactions: approval tx (if allowance insufficient) + deposit tx.

```ts
params: {
  vault: Address
  token: Address         // underlying token to deposit
  owner: Address         // who owns the tokens (wallet address)
  amount: bigint
  recipient?: Address    // defaults to owner
  slippageBps?: number
  partnerId?: number
  chainId?: number
}
```

### `prepareRedeemWithApproval(params): Promise<PreparedTransaction[]>`

**Recommended for redeems.** Checks vault share allowance on-chain. Returns 1-2 transactions: share approval tx (if needed) + redeem tx.

```ts
params: {
  vault: Address
  shares: bigint
  owner: Address         // who owns the shares (wallet address)
  recipient?: Address    // defaults to owner
  slippageBps?: number
  partnerId?: number
  chainId?: number
}
```

______________________________________________________________________

## Gateway Quote Helpers

On-chain reads against the Gateway contract (may differ from direct vault reads due to fees).

### `quotePreviewDeposit(vault: Address, assets: bigint): Promise<bigint>`

### `quotePreviewRedeem(vault: Address, shares: bigint): Promise<bigint>`

### `quotePreviewWithdraw(vault: Address, assets: bigint): Promise<bigint>`

### `quoteConvertToAssets(vault: Address, shares: bigint): Promise<bigint>`

### `quoteConvertToShares(vault: Address, assets: bigint): Promise<bigint>`

______________________________________________________________________

## Gateway Allowance Helpers

### `getShareAllowance(vault: Address, owner: Address): Promise<bigint>`

Share allowance granted to the Gateway.

### `getAssetAllowance(vault: Address, owner: Address): Promise<bigint>`

Asset allowance granted to the Gateway.

______________________________________________________________________

## REST API Methods

Off-chain queries to `https://api.yo.xyz`. No RPC needed.

### Vault Data

#### `getVaultStats(): Promise<VaultStatsItem[]>`

All vaults aggregated statistics — TVL, yield, share price, cap.

#### `getVaultSnapshots(): Promise<VaultSnapshot[]>`

Snapshots for all vaults.

#### `getVaultSnapshot(vault: Address): Promise<VaultSnapshot>`

Comprehensive vault data: TVL, yield (1d/7d/30d), protocols, share price, idle balances.

#### `getVaultYieldHistory(vault: Address): Promise<TimeseriesPoint[]>`

Historical yield data. Returns `{ timestamp, value }[]`.

#### `getVaultTvlHistory(vault: Address): Promise<TimeseriesPoint[]>`

Historical TVL data. Returns `{ timestamp, value }[]`.

#### `getTotalTvlTimeseries(): Promise<TotalTvlTimeseriesPoint[]>`

Total TVL time series across all vaults.

#### `getSharePriceHistory(vault: Address): Promise<SharePriceHistoryPoint[]>`

Historical share price data.

#### `getVaultAllocationsTimeSeries(vault: Address): Promise<DailyAllocationSnapshot[]>`

Protocol allocation time series.

#### `getVaultPerformance(vault: Address): Promise<VaultPerformance>`

Vault realized and unrealized performance.

#### `getVaultPercentile(vault: Address): Promise<VaultPercentile>`

Vault ranking compared to other DeFi pools.

#### `getPerformanceBenchmark(vault: Address): Promise<PerformanceBenchmark>`

Benchmark data comparing vault performance against other pools.

#### `getVaultPendingRedeems(vault: Address): Promise<FormattedValue>`

Total pending redeems for a vault.

### History

#### `getVaultHistory(vault: Address, limit?: number): Promise<VaultHistoryResponse>`

Vault transaction history for a single network.

#### `getVaultHistoryAllNetworks(vault: Address, options?): Promise<VaultHistoryResponse>`

Vault transaction history across all networks. Options: `{ cursor?, limit?, filters? }`.

#### `getGlobalVaultHistory(options?): Promise<GlobalVaultHistoryResponse>`

Global vault history across ALL vaults and networks. Options: `{ cursor?, limit?, filters? }`.

### User Data

#### `getUserHistory(vault: Address, user: Address, limit?: number): Promise<UserHistoryItem[]>`

User transaction history (deposits, withdraws, redeems).

#### `getUserPerformance(vault: Address, user: Address): Promise<UserPerformance>`

User realized/unrealized P&L. Returns `{ realized: FormattedValue, unrealized: FormattedValue }`.

#### `getPendingRedemptions(vault: Address, user: Address): Promise<PendingRedeem>`

User's pending redeem requests.

#### `getUserSnapshots(vault: Address, user: Address): Promise<UserSnapshot[]>`

Historical balance snapshots for a user.

#### `getUserBalances(user: Address): Promise<UserBalances>`

User's balances across all vaults.

#### `getUserRewardsByAsset(user: Address, tokenAddress: string): Promise<UserRewardsByAssetResponse>`

User's rewards for a specific asset.

### Leaderboard & Pricing

#### `getWeeklyRewards(tokenAddress: string): Promise<WeeklyRewardsResponse>`

Weekly reward leaderboard.

#### `getAllTimeRewards(tokenAddress: string): Promise<AllTimeRewardsResponse>`

All-time reward leaderboard.

#### `getPrices(): Promise<PriceMap>`

Current token prices (address → USD price map).

______________________________________________________________________

## Merkl Reward Methods

### `getMerklCampaigns(options?: { status?: 'LIVE' | 'PAST' }): Promise<MerklCampaign[]>`

List Yo-related Merkl campaigns.

### `getMerklRewards(user: Address): Promise<MerklChainRewards | null>`

Raw API rewards for user on client's chain.

### `getMerklClaimedAmount(user: Address, token: Address): Promise<bigint>`

On-chain claimed amount for a specific reward token.

### `getClaimableRewards(user: Address): Promise<MerklChainRewards | null>`

**Preferred method.** Merges API rewards with on-chain claimed amounts for accurate claimable data.

### `prepareClaimMerklRewards(user: Address, chainRewards: MerklChainRewards): PreparedTransaction`

Prepare claim transaction. Returns `{ to, data, value }` to send via wallet.

### Utility methods

- `getMerklClaimableAmount(reward: MerklTokenReward): bigint` — claimable for single reward
- `hasMerklClaimableRewards(chainRewards: MerklChainRewards): boolean` — any claimable?
- `getMerklTotalClaimable(chainRewards: MerklChainRewards): bigint` — total claimable amount

______________________________________________________________________

## Transaction Helpers

### `waitForTransaction(hash): Promise<TransactionReceipt>`

Wait for any tx confirmation. Returns `{ hash, status, blockNumber, gasUsed }`.

### `waitForRedeemReceipt(hash): Promise<RedeemReceipt>`

Wait for redeem tx and decode the `YoGatewayRedeem` event. Returns `{ hash, status, instant, assetsOrRequestId, shares, blockNumber }`.

______________________________________________________________________

## Utilities

### Formatting

```ts
import { formatTokenAmount, parseTokenAmount, formatUsd, formatPercent, formatCompactNumber } from '@yo-protocol/core'

formatTokenAmount(1000000n, 6)                          // "1"
formatTokenAmount(1000000n, 6, { maxDecimals: 2 })      // "1"
parseTokenAmount("1.5", 18)                             // 1500000000000000000n
formatUsd(1234.5)                                       // "$1,234.50"
formatPercent(0.0534)                                   // "5.34%"
formatCompactNumber(1234567)                            // "1.23M"
```

### Math Helpers (big.js-based)

All accept `string | number | bigint | Big`:

`mul`, `div`, `add`, `sub`, `mulDiv`, `gt`, `gte`, `lt`, `lte`, `eq`, `toFixed`, `toNumber`, `abs`, `pow`, `sqrt`, `toBigInt`, `toStr`

`applySlippage(value: bigint, slippageBps: number): bigint` — `value - (value * bps) / 10000`

### Validation

```ts
import { validateAddress, validateAmount } from '@yo-protocol/core'

validateAddress('0x...', 'vault')   // throws if invalid
validateAmount(100n, 'amount')      // throws if <= 0
```
