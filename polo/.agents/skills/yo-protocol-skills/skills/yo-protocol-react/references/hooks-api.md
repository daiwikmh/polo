# @yo-protocol/react Hooks API Reference

## Table of Contents

- [Query Hook Pattern](#query-hook-pattern)
- [Action Hook Pattern](#action-hook-pattern)
- [Vault On-Chain Hooks](#vault-on-chain-hooks)
- [Vault API Hooks](#vault-api-hooks)
- [User On-Chain Hooks](#user-on-chain-hooks)
- [User API Hooks](#user-api-hooks)
- [Leaderboard Hooks](#leaderboard-hooks)
- [Merkl Hooks](#merkl-hooks)
- [Action Hooks](#action-hooks)
- [Context & Utility Hooks](#context--utility-hooks)

## Query Hook Pattern

All read hooks follow this pattern:

```tsx
function useXxx(params, options?: { enabled?: boolean }) {
  const client = useYoClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['yo-xxx', ...params, client?.chainId],
    queryFn: () => client!.someMethod(...params),
    enabled: enabled && !!client,
    staleTime: 30_000,
  })
  return { fieldName: data, isLoading, isError, error: error ?? null, refetch }
}
```

Every query hook returns: `{ data, isLoading, isError, error, refetch }`

## Action Hook Pattern

All transaction hooks follow the prepare+send pattern:

```tsx
function useXxx(options: { vault, callbacks }) {
  const client = useYoClient()
  const { sendTransactionAsync } = useSendTransaction()
  // 1. client.prepareX() → PreparedTransaction[]
  // 2. sendTransactionAsync({ to, data, value }) for each tx
  // 3. Track step state through lifecycle
  // 4. Invalidate React Query cache on confirmation
}
```

## Vault On-Chain Hooks

### useVaultState(vault, options?)

```tsx
useVaultState(vault: Address | VaultId, options?: { enabled?: boolean })
→ { vaultState: VaultState | undefined, isLoading, isError, error, refetch }
// Key: ['yo-vault-state', vaultAddress, chainId]
// staleTime: 30s, refetchInterval: 60s
```

`VaultState`: `{ address, name, symbol, decimals, totalAssets, totalSupply, asset, assetDecimals, exchangeRate }`

### usePreviewDeposit(vault, assets, options?)

```tsx
usePreviewDeposit(vault: Address | VaultId, assets: bigint | undefined, options?: { enabled?: boolean })
→ { shares: bigint | undefined, isLoading, isError, error, refetch }
// Key: ['yo-preview-deposit', vaultAddress, assets?.toString(), chainId]
```

### usePreviewRedeem(vault, shares, options?)

```tsx
usePreviewRedeem(vault: Address | VaultId, shares: bigint | undefined, options?: { enabled?: boolean })
→ { assets: bigint | undefined, isLoading, isError, error, refetch }
// Key: ['yo-preview-redeem', vaultAddress, shares?.toString(), chainId]
```

## Vault API Hooks

### useVaults(options?)

```tsx
useVaults(options?: { enabled?: boolean })
→ { vaults: VaultConfig[], isLoading, isError, error }
// Key: ['yo-vaults', chainId]
// staleTime: Infinity (vault configs rarely change)
```

### useVaultStats(options?)

```tsx
useVaultStats(options?: { enabled?: boolean })
→ { stats: VaultStatsItem[], isLoading, isError, error, refetch }
// Key: ['yo-vault-stats', chainId]
```

### useVaultSnapshot(vault, options?)

```tsx
useVaultSnapshot(vault: Address | VaultId, options?: { enabled?: boolean })
→ { snapshot: VaultSnapshot | undefined, isLoading, isError, error, refetch }
// Key: ['yo-vault-snapshot', vaultAddress, chainId]
```

### useVaultSnapshots(options?)

```tsx
useVaultSnapshots(options?: { enabled?: boolean })
→ { snapshots: VaultSnapshot[], isLoading, isError, error, refetch }
// Key: ['yo-vault-snapshots', chainId]
```

### useVaultHistory(vault, options?)

```tsx
useVaultHistory(vault: Address | VaultId, options?: { enabled?: boolean })
→ { yieldHistory: TimeseriesPoint[], tvlHistory: TimeseriesPoint[], isLoading, isError, error, refetch }
// Keys: ['yo-vault-yield-history', vaultAddress, chainId] + ['yo-vault-tvl-history', vaultAddress, chainId]
```

### useVaultTransactionHistory(vault, options?)

```tsx
useVaultTransactionHistory(vault: Address | VaultId, options?: {
  limit?: number; cursor?: string; filters?: string; allNetworks?: boolean; enabled?: boolean
})
→ { history: VaultHistoryResponse | undefined, isLoading, isError, error, refetch }
// Key: ['yo-vault-tx-history', vaultAddress, allNetworks, cursor, limit, filters, chainId]
```

### useGlobalVaultHistory(options?)

```tsx
useGlobalVaultHistory(options?: { cursor?: string; limit?: number; filters?: string; enabled?: boolean })
→ { history: GlobalVaultHistoryResponse | undefined, isLoading, isError, error, refetch }
// Key: ['yo-global-vault-history', cursor, limit, filters, chainId]
```

### useVaultPerformance(vault, options?)

```tsx
useVaultPerformance(vault: Address | VaultId, options?: { enabled?: boolean })
→ { performance: VaultPerformance | undefined, isLoading, isError, error, refetch }
// Key: ['yo-vault-performance', vaultAddress, chainId]
```

### useVaultPercentile(vault, options?)

```tsx
useVaultPercentile(vault: Address | VaultId, options?: { enabled?: boolean })
→ { percentile: VaultPercentile | undefined, isLoading, isError, error, refetch }
// Key: ['yo-vault-percentile', vaultAddress, chainId]
```

### usePerformanceBenchmark(vault, options?)

```tsx
usePerformanceBenchmark(vault: Address | VaultId, options?: { enabled?: boolean })
→ { benchmark: PerformanceBenchmark | undefined, isLoading, isError, error, refetch }
// Key: ['yo-performance-benchmark', vaultAddress, chainId]
```

### useVaultAllocations(vault, options?)

```tsx
useVaultAllocations(vault: Address | VaultId, options?: { enabled?: boolean })
→ { allocations: DailyAllocationSnapshot[], isLoading, isError, error, refetch }
// Key: ['yo-vault-allocations', vaultAddress, chainId]
```

### useVaultPendingRedeems(vault, options?)

```tsx
useVaultPendingRedeems(vault: Address | VaultId, options?: { enabled?: boolean })
→ { pendingRedeems: FormattedValue | undefined, isLoading, isError, error, refetch }
// Key: ['yo-vault-pending-redeems', vaultAddress, chainId]
```

### useSharePriceHistory(vault, options?)

```tsx
useSharePriceHistory(vault: Address | VaultId, options?: { enabled?: boolean })
→ { history: SharePriceHistoryPoint[], isLoading, isError, error, refetch }
// Key: ['yo-share-price-history', vaultAddress, chainId]
```

### useTotalTvl(options?)

```tsx
useTotalTvl(options?: { enabled?: boolean })
→ { tvl: TotalTvlTimeseriesPoint[], isLoading, isError, error, refetch }
// Key: ['yo-total-tvl', chainId]
```

### usePrices(options?)

```tsx
usePrices(options?: { enabled?: boolean })
→ { prices: PriceMap, isLoading, isError, error, refetch }
// Key: ['yo-prices', chainId]
```

## User On-Chain Hooks

### useUserPosition(vault, account?, options?)

```tsx
useUserPosition(vault: Address | VaultId, account?: Address, options?: { enabled?: boolean })
→ { position: UserVaultPosition | undefined, isLoading, isError, error, refetch }
// Key: ['yo-user-position', vaultAddress, userAddress, chainId]
// staleTime: 15s, refetchInterval: 30s
// account defaults to connected wallet
```

`UserVaultPosition`: `{ shares: bigint, assets: bigint }`

### useUserPositions(account?, options?)

```tsx
useUserPositions(account?: Address, options?: { enabled?: boolean })
→ { positions: Array<{ vault, position: UserVaultPosition }>, isLoading, isError, error, refetch }
// Key: ['yo-user-positions', userAddress, chainId]
```

### useTokenBalance(token, account?, options?)

```tsx
useTokenBalance(token: Address | undefined, account?: Address, options?: { enabled?: boolean })
→ { balance: TokenBalance | undefined, isLoading, isError, error, refetch }
// Key: ['yo-token-balance', token, userAddress, chainId]
```

### useShareBalance(vault, account?, options?)

```tsx
useShareBalance(vault: Address | VaultId, account?: Address, options?: { enabled?: boolean })
→ { shares: bigint | undefined, isLoading, isError, error, refetch }
// Key: ['yo-share-balance', vaultAddress, userAddress, chainId]
```

### useAllowance(token, spender, owner?, options?)

```tsx
useAllowance(token: Address | undefined, spender: Address | undefined, owner?: Address, options?: { enabled?: boolean })
→ { allowance: TokenAllowance | undefined, isLoading, isError, error, refetch }
// Key: ['yo-allowance', token, ownerAddress, spender, chainId]
```

## User API Hooks

### useUserHistory(vault, user?, options?)

```tsx
useUserHistory(vault: Address | VaultId, user?: Address, options?: { limit?: number; enabled?: boolean })
→ { history: UserHistoryItem[], isLoading, isError, error, refetch }
// Key: ['yo-user-history', vaultAddress, account, limit, chainId]
```

### useUserPerformance(vault, user?, options?)

```tsx
useUserPerformance(vault: Address | VaultId, user?: Address, options?: { enabled?: boolean })
→ { performance: UserPerformance | undefined, isLoading, isError, error, refetch }
// Key: ['yo-user-performance', vaultAddress, account, chainId]
```

### useUserSnapshots(vault, user?, options?)

```tsx
useUserSnapshots(vault: Address | VaultId, user?: Address, options?: { enabled?: boolean })
→ { snapshots: UserSnapshot[], isLoading, isError, error, refetch }
// Key: ['yo-user-snapshots', vaultAddress, account, chainId]
```

### useUserBalances(user?, options?)

```tsx
useUserBalances(user?: Address, options?: { enabled?: boolean })
→ { balances: UserBalances | undefined, isLoading, isError, error, refetch }
// Key: ['yo-user-balances', account, chainId]
```

### usePendingRedemptions(vault, user?, options?)

```tsx
usePendingRedemptions(vault: Address | VaultId, user?: Address, options?: { enabled?: boolean })
→ { pendingRedemptions: PendingRedeem | undefined, isLoading, isError, error, refetch }
// Key: ['yo-pending-redemptions', vaultAddress, account, chainId]
```

### useUserRewards(tokenAddress, user?, options?)

```tsx
useUserRewards(tokenAddress: string, user?: Address, options?: { enabled?: boolean })
→ { rewards: UserRewardsByAssetResponse | undefined, isLoading, isError, error, refetch }
// Key: ['yo-user-rewards', account, tokenAddress, chainId]
```

## Leaderboard Hooks

### useLeaderboard(period, tokenAddress, options?)

```tsx
useLeaderboard(period: 'weekly' | 'allTime', tokenAddress: string, options?: { enabled?: boolean })
→ { data: WeeklyRewardsResponse | AllTimeRewardsResponse | undefined, isLoading, isError, error, refetch }
// Key: ['yo-leaderboard', period, tokenAddress, chainId]
// staleTime: 5min
```

## Merkl Hooks

### useMerklCampaigns(options?)

```tsx
useMerklCampaigns(options?: { status?: MerklCampaignStatus; enabled?: boolean })
→ { campaigns: MerklCampaign[], isLoading, isError, error, refetch }
// Key: ['merkl-campaigns', status, chainId]
```

### useMerklRewards(account?, options?)

```tsx
useMerklRewards(account?: Address, options?: { enabled?: boolean })
→ { rewards: MerklChainRewards | undefined, totalClaimable: bigint, hasClaimable: boolean, isLoading, isError, error, refetch }
// Key: ['merkl-rewards', userAddress, chainId]
// staleTime: 60s, refetchInterval: 120s
// Computes totalClaimable and hasClaimable from raw rewards
```

## Action Hooks

### useDeposit(options)

```tsx
useDeposit(options: {
  vault: Address | VaultId
  slippageBps?: number  // defaults to provider's defaultSlippageBps
  onSubmitted?: (hash: Hash) => void
  onConfirmed?: (hash: Hash) => void
  onError?: (error: Error) => void
})
→ {
  deposit: (params: { token: Address; amount: bigint; chainId?: number }) => Promise<Hash>
  step: 'idle' | 'switching-chain' | 'approving' | 'depositing' | 'waiting' | 'success' | 'error'
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  hash: Hash | undefined       // deposit tx hash
  approveHash: Hash | undefined // approval tx hash (if needed)
  reset: () => void
}
// Invalidates: yo-user-position, yo-vault-state, yo-token-balance, yo-share-balance
```

### useRedeem(options)

```tsx
useRedeem(options: {
  vault: Address | VaultId
  onSubmitted?: (hash: Hash) => void
  onConfirmed?: (hash: Hash) => void
  onError?: (error: Error) => void
})
→ {
  redeem: (shares: bigint) => Promise<Hash>
  step: 'idle' | 'approving' | 'redeeming' | 'waiting' | 'success' | 'error'
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  hash: Hash | undefined
  approveHash: Hash | undefined
  instant: boolean | undefined       // true if redeemed immediately
  assetsOrRequestId: string | undefined // asset amount or queued request ID
  reset: () => void
}
// Invalidates: yo-user-position, yo-vault-state, yo-share-balance, yo-pending-redemptions
```

### useApprove(options)

```tsx
useApprove(options: {
  token: Address
  spender?: Address  // defaults to YO_GATEWAY_ADDRESS
  onSubmitted?: (hash: Hash) => void
  onConfirmed?: (hash: Hash) => void
  onError?: (error: Error) => void
})
→ {
  approve: (amount: bigint) => Promise<Hash>
  approveMax: () => Promise<Hash>   // approves maxUint256
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  hash: Hash | undefined
  reset: () => void
}
```

### useClaimMerklRewards(options?)

```tsx
useClaimMerklRewards(options?: {
  onSubmitted?: (hash: Hash) => void
  onConfirmed?: (hash: Hash) => void
  onError?: (error: Error) => void
})
→ {
  claim: (chainRewards: MerklChainRewards) => Promise<Hash>
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  hash: Hash | undefined
  reset: () => void
}
// Invalidates: merkl-rewards
```

## Context & Utility Hooks

### useYieldConfig()

```tsx
useYieldConfig()
→ { ready: boolean, partnerId?: number, defaultSlippageBps: number, onError?: (error: Error) => void }
// Must be inside YieldProvider
```

### useYoClient()

```tsx
useYoClient()
→ YoClient | null
// Returns null when provider not ready, chain unsupported, or publicClient unavailable
```

### useCreateYoClient(options)

```tsx
useCreateYoClient(options: {
  chainId: number
  partnerId?: number
  publicClients?: Partial<Record<SupportedChainId, PublicClient>>
})
→ YoClient | null
// Standalone client creation — use outside YieldProvider
```
