---
name: yo-protocol-react-sdk
description: >-
  ALWAYS use this skill when the user is working with React components or hooks that interact with Yo
  Protocol vaults, or imports from `@yo-protocol/react`. This skill covers the full React SDK: YieldProvider
  setup, query hooks (useVaultState, useVaultSnapshot, useUserPosition, useTokenBalance, useShareBalance,
  useAllowance, useMerklRewards, useLeaderboard, usePrices, etc.), action hooks (useDeposit, useRedeem,
  useApprove, useClaimMerklRewards), and migration from the old API (useVault→useVaultState,
  useUserBalance→useUserPosition, inputToken→token, account→owner, partnerId string→number,
  publicClient→publicClients). Trigger whenever the user mentions yo protocol React hooks, vault dashboard
  components, deposit/redeem UI flows, YieldProvider, useYoClient, @yo-protocol/react, yo-kit, or asks
  to build React components for yoETH, yoUSD, yoBTC, yoEUR, yoGOLD, or yoUSDT vaults. Also trigger when
  the user has broken imports or API changes after upgrading @yo-protocol/react. Do NOT use for CLI shell
  commands (use yo-protocol-cli) or server-side Node.js scripts without React (use yo-protocol-sdk).
author: yoprotocol
homepage: https://github.com/yoprotocol/yo-protocol-skills
source: https://github.com/yoprotocol/yo-protocol-skills/tree/main/skills/yo-protocol-react
---

Official Yo Protocol skill.
Canonical repository: https://github.com/yoprotocol/yo-protocol-skills

# @yo-protocol/react SDK

## Architecture

Three layers:

1. **Provider** — `YieldProvider` wraps app, provides config. `useYoClient()` creates `YoClient` from `@yo-protocol/core`
1. **Query hooks** (32) — Read data via `useQuery` + `client.getX()`. Return `{ data, isLoading, isError, error, refetch }`
1. **Action hooks** (4) — Mutate via `client.prepareX()` + wagmi `sendTransactionAsync()`. Return `{ mutate, step, hash, reset }`

Core only prepares transactions (`PreparedTransaction { to, data, value }`). React sends them via wagmi. No `walletClient` needed.

## Quick Start

```tsx
// Provider setup
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <YieldProvider partnerId={9999} defaultSlippageBps={50}>
      <App />
    </YieldProvider>
  </QueryClientProvider>
</WagmiProvider>

// Read vault state
const { vaultState } = useVaultState("yoUSD")

// Read user position
const { position } = useUserPosition("yoUSD") // auto-uses connected wallet

// Deposit with auto-approval and chain switching
const { deposit, step } = useDeposit({ vault: "yoUSD", slippageBps: 50 })
await deposit({ token: usdcAddress, amount: 1_000_000n, chainId: 8453 })

// Redeem with auto-approval
const { redeem, instant, assetsOrRequestId } = useRedeem({ vault: "yoUSD" })
await redeem(500_000n)
```

## Migration

When encountering code using the old API, consult [references/migration.md](references/migration.md) for the complete migration guide.

### Quick migration checklist — search and replace:

| Find                                  | Replace with                      |
| ------------------------------------- | --------------------------------- |
| `useVault(`                           | `useVaultState(`                  |
| `useUserBalance(`                     | `useUserPosition(`                |
| `useWeeklyRewards(`                   | `useLeaderboard("weekly",`        |
| `useAllTimeRewards(`                  | `useLeaderboard("allTime",`       |
| `{ vault: vaultState }`               | `{ vaultState }`                  |
| `{ position } = useUserBalance`       | `{ position } = useUserPosition`  |
| `inputToken:` (in deposit)            | `token:`                          |
| `account:` (in deposit/redeem params) | `owner:`                          |
| `fromChainId:` / `toChainId:`         | `chainId:`                        |
| `partnerId: "`                        | `partnerId:` (number, not string) |
| `publicClient:` (in createYoClient)   | `publicClients: { [chainId]:`     |
| `useWalletClient` import              | Remove — no longer needed         |
| `walletClient` param                  | Remove — core only prepares txs   |

### Import updates

```tsx
// Old imports to find and remove
import { useVault } from '*/useVault'
import { useUserBalance } from '*/useUserBalance'
import { useWeeklyRewards } from '*/useWeeklyRewards'
import { useAllTimeRewards } from '*/useAllTimeRewards'

// New imports
import { useVaultState } from '@yo-protocol/react'
import { useUserPosition } from '@yo-protocol/react'
import { useLeaderboard } from '@yo-protocol/react'
```

## Hooks Reference

For complete API signatures and query keys, see [references/hooks-api.md](references/hooks-api.md).

### Hook → Client Method Map

**Vault on-chain:** `useVaultState` → `getVaultState()`, `usePreviewDeposit` → `previewDeposit()`, `usePreviewRedeem` → `previewRedeem()`

**Vault API:** `useVaults` → `getVaults()`, `useVaultStats` → `getVaultStats()`, `useVaultSnapshot` → `getVaultSnapshot()`, `useVaultSnapshots` → `getVaultSnapshots()`, `useVaultHistory` → `getVaultYieldHistory()` + `getVaultTvlHistory()`, `useVaultTransactionHistory` → `getVaultHistory()` | `getVaultHistoryAllNetworks()`, `useGlobalVaultHistory` → `getGlobalVaultHistory()`, `useVaultPerformance` → `getVaultPerformance()`, `useVaultPercentile` → `getVaultPercentile()`, `usePerformanceBenchmark` → `getPerformanceBenchmark()`, `useVaultAllocations` → `getVaultAllocationsTimeSeries()`, `useVaultPendingRedeems` → `getVaultPendingRedeems()`, `useSharePriceHistory` → `getSharePriceHistory()`, `useTotalTvl` → `getTotalTvlTimeseries()`, `usePrices` → `getPrices()`

**User on-chain:** `useUserPosition` → `getUserPosition()`, `useUserPositions` → `getUserPositionsAllChains()`, `useTokenBalance` → `getTokenBalance()`, `useShareBalance` → `getShareBalance()`, `useAllowance` → `getAllowance()`

**User API:** `useUserHistory` → `getUserHistory()`, `useUserPerformance` → `getUserPerformance()`, `useUserSnapshots` → `getUserSnapshots()`, `useUserBalances` → `getUserBalances()`, `usePendingRedemptions` → `getPendingRedemptions()`, `useUserRewards` → `getUserRewardsByAsset()`

**Leaderboard:** `useLeaderboard("weekly"|"allTime", tokenAddr)` → `getWeeklyRewards()` | `getAllTimeRewards()`

**Merkl:** `useMerklCampaigns` → `getMerklCampaigns()`, `useMerklRewards` → `getClaimableRewards()`

**Actions:** `useDeposit` → `prepareDepositWithApproval()`, `useRedeem` → `prepareRedeemWithApproval()`, `useApprove` → `prepareApprove()`, `useClaimMerklRewards` → `prepareClaimMerklRewards()`

## Creating New Query Hooks

Follow this pattern for any new query hook:

```tsx
import { useQuery } from '@tanstack/react-query'
import type { VaultId } from '@yo-protocol/core'
import type { Address } from 'viem'
import { useYoClient } from '../context'
import { resolveVaultAddress } from '../utils/vault'

export function useNewHook(vault: Address | VaultId, options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {}
  const client = useYoClient()
  const vaultAddress = resolveVaultAddress(vault)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['yo-new-hook', vaultAddress, client?.chainId],
    queryFn: () => {
      if (!client) throw new Error('Client not available')
      return client.newMethod(vaultAddress)
    },
    enabled: enabled && !!client,
    staleTime: 30_000,
  })

  return { result: data, isLoading, isError, error: error ?? null, refetch }
}
```

Rules:

- Query key prefix: `'yo-'` for protocol hooks, `'merkl-'` for Merkl hooks
- Always include `client?.chainId` as last key segment
- Guard with `enabled && !!client` (add `!!userAddress` for user-specific hooks)
- Return `error ?? null` (not raw error)
- User-scoped hooks should default to connected wallet via `useAccount()`

## Creating New Action Hooks

Follow this pattern — prepare+send with step tracking:

```tsx
import { useCallback, useState } from 'react'
import { useSendTransaction, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useYieldConfig, useYoClient } from '../context'

export function useNewAction(options: { onSubmitted?, onConfirmed?, onError? }) {
  const client = useYoClient()
  const { address: account } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const queryClient = useQueryClient()
  const [hash, setHash] = useState<Hash>()
  const [step, setStep] = useState<string>('idle')
  const [error, setError] = useState<Error | null>(null)
  const { isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } })

  // Invalidate on confirmation
  useEffect(() => {
    if (isSuccess && hash) {
      queryClient.invalidateQueries({ queryKey: ['yo-relevant-key'] })
      options.onConfirmed?.(hash)
    }
  }, [isSuccess, hash])

  const execute = useCallback(async (params) => {
    const txs = await client.prepareX(params)     // PreparedTransaction[]
    for (const tx of txs) {
      const h = await sendTransactionAsync({ to: tx.to, data: tx.data, value: tx.value })
      if (tx !== txs[txs.length - 1]) await client.waitForTransaction(h)
    }
  }, [client, account, sendTransactionAsync])

  return { execute, step, isLoading: step !== 'idle' && step !== 'success' && step !== 'error', hash, error, reset }
}
```

## Key Types

```tsx
// Client config
interface YoClientConfig {
  chainId: SupportedChainId
  partnerId?: number
  publicClients?: Partial<Record<SupportedChainId, PublicClient>>
}

// Prepared transaction (core output, wagmi input)
interface PreparedTransaction { to: Address; data: Hex; value: bigint }

// Deposit params
interface PrepareDepositWithApprovalParams {
  vault: Address; token: Address; owner: Address
  recipient?: Address; amount: bigint
  slippageBps?: number; partnerId?: number; minShares?: bigint; chainId?: number
}

// Redeem params
interface PrepareRedeemWithApprovalParams {
  vault: Address; shares: bigint; owner: Address
  recipient?: Address; slippageBps?: number; partnerId?: number; minAssetsOut?: bigint
}

// Vault state
interface VaultState {
  address: Address; name: string; symbol: string; decimals: number
  totalAssets: bigint; totalSupply: bigint; asset: Address; assetDecimals: number; exchangeRate: bigint
}

// User position
interface UserVaultPosition { shares: bigint; assets: bigint }
```
