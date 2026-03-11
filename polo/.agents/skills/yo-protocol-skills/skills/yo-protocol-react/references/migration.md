# Migration Guide: @yo-protocol/react v0 → v1

## Table of Contents

- [Client Creation](#client-creation)
- [Hook Renames](#hook-renames)
- [Removed Hooks](#removed-hooks)
- [Transaction Hooks](#transaction-hooks)
- [Provider Changes](#provider-changes)
- [Type Changes](#type-changes)
- [Query Key Changes](#query-key-changes)

## Client Creation

### Before (v0)

```tsx
import { createYoClient } from '@yo-protocol/core'

const client = createYoClient({
  chainId: 8453,
  partnerId: "9999",         // string
  publicClient: viemClient,  // single PublicClient
  walletClient: walletClient, // WalletClient required
})
```

### After (v1)

```tsx
import { createYoClient } from '@yo-protocol/core'

const client = createYoClient({
  chainId: 8453,
  partnerId: 9999,           // number
  publicClients: {           // map of PublicClient by chainId
    8453: viemClient,
  },
  // no walletClient — transactions prepared, not sent
})
```

**Key changes:**

- `partnerId`: `string` → `number`
- `publicClient` → `publicClients` (map keyed by `SupportedChainId`)
- `walletClient` removed — core only prepares transactions now

### Context hook

```tsx
// Before
const publicClient = usePublicClient()
const { data: walletClient } = useWalletClient()
createYoClient({ chainId, partnerId: "9999", publicClient, walletClient })

// After
const publicClient = usePublicClient()
createYoClient({
  chainId: chainId as SupportedChainId,
  partnerId: 9999,
  publicClients: { [chainId]: publicClient },
})
```

## Hook Renames

| Old Name                     | New Name                                                   | Notes                                            |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `useVault`                   | `useVaultState`                                            | Returns `{ vaultState }` not `{ vault }`         |
| `useUserBalance`             | `useUserPosition`                                          | Returns `{ position }` with `{ shares, assets }` |
| `useWeeklyRewards`           | `useLeaderboard("weekly", tokenAddr)`                      | Merged into single hook                          |
| `useAllTimeRewards`          | `useLeaderboard("allTime", tokenAddr)`                     | Merged into single hook                          |
| `useVaultHistoryAllNetworks` | `useVaultTransactionHistory(vault, { allNetworks: true })` | Merged with flag                                 |

### Destructuring changes

```tsx
// Before
const { vault: vaultState } = useVault("yoUSD")
const { position } = useUserBalance("yoUSD", address)

// After
const { vaultState } = useVaultState("yoUSD")
const { position } = useUserPosition("yoUSD", address)
```

## Removed Hooks

These hooks were removed. Use the listed alternatives:

| Removed Hook              | Alternative                                      |
| ------------------------- | ------------------------------------------------ |
| `useConvertToAssets`      | Call `client.convertToAssets()` directly         |
| `useConvertToShares`      | Call `client.convertToShares()` directly         |
| `useIsPaused`             | Call `client.isPaused()` directly                |
| `useIdleBalance`          | Call `client.getIdleBalance()` directly          |
| `useQuotePreviewDeposit`  | Call `client.quotePreviewDeposit()` directly     |
| `useQuotePreviewRedeem`   | Call `client.quotePreviewRedeem()` directly      |
| `useQuotePreviewWithdraw` | Call `client.quotePreviewWithdraw()` directly    |
| `useShareAllowance`       | `useAllowance(vaultAddress, spender, owner)`     |
| `useAssetAllowance`       | `useAllowance(tokenAddress, spender, owner)`     |
| `useHasEnoughAllowance`   | Compare `useAllowance().allowance >= amount`     |
| `useMerklClaimedAmount`   | Use `useMerklRewards()` which includes breakdown |

## Transaction Hooks

Core no longer has `deposit()`, `redeem()`, `approve()`, `claimMerklRewards()` methods. It only exposes `prepareX()` methods that return `PreparedTransaction` objects. The React hooks now use wagmi's `useSendTransaction` to send them.

### useDeposit

**Before:**

```tsx
const { deposit, isLoading, hash } = useDeposit({ vault: "yoUSD" })

await deposit({
  inputToken: usdcAddress,
  amount: 1_000_000n,
  fromChainId: 8453,
  toChainId: 8453,
})
```

**After:**

```tsx
const { deposit, step, isLoading, hash, approveHash } = useDeposit({
  vault: "yoUSD",
  slippageBps: 50,
  onSubmitted: (hash) => {},
  onConfirmed: (hash) => {},
  onError: (err) => {},
})

await deposit({
  token: usdcAddress,     // was inputToken
  amount: 1_000_000n,
  chainId: 8453,          // was fromChainId/toChainId
})
```

**Changes:**

- `inputToken` → `token`
- `fromChainId`/`toChainId` → single `chainId` (optional, triggers chain switch)
- New `step` field: `'idle' | 'switching-chain' | 'approving' | 'depositing' | 'waiting' | 'success' | 'error'`
- New `approveHash` — hash of the approval tx if one was needed
- Auto-handles approval check via `prepareDepositWithApproval()`

### useRedeem

**Before:**

```tsx
const { redeem, hash } = useRedeem({ vault: "yoUSD" })
await redeem(500_000n)
```

**After:**

```tsx
const { redeem, step, hash, approveHash, instant, assetsOrRequestId } = useRedeem({
  vault: "yoUSD",
  onSubmitted: (hash) => {},
  onConfirmed: (hash) => {},
})
await redeem(500_000n)
// instant — true if redeemed immediately
// assetsOrRequestId — asset amount (instant) or request ID (queued)
```

**Changes:**

- New `step` field: `'idle' | 'approving' | 'redeeming' | 'waiting' | 'success' | 'error'`
- New `approveHash`, `instant`, `assetsOrRequestId` fields
- Auto-handles share approval via `prepareRedeemWithApproval()`

### useApprove

**Before:**

```tsx
const { approve } = useApprove({ token, spender })
await approve(amount)
```

**After (same API, different internals):**

```tsx
const { approve, approveMax, hash, isLoading } = useApprove({
  token: usdcAddress,
  spender: gatewayAddress, // optional, defaults to YO_GATEWAY_ADDRESS
  onConfirmed: (hash) => {},
})
await approve(1_000_000n)
await approveMax() // approves maxUint256
```

### useClaimMerklRewards

**Before:**

```tsx
const { claim } = useClaimMerklRewards()
await claim(claimParams) // raw ClaimMerklRewardsParams
```

**After:**

```tsx
const { claim, hash } = useClaimMerklRewards({ onConfirmed: (hash) => {} })
await claim(chainRewards) // MerklChainRewards from useMerklRewards()
```

## Provider Changes

### YieldProvider

```tsx
// Before
<YieldProvider partnerId="9999" defaultSlippageBps={50}>

// After
<YieldProvider partnerId={9999} defaultSlippageBps={50}>
```

- `partnerId`: `string` → `number`

## Type Changes

### Core types

```tsx
// Before
interface YoClientConfig {
  chainId: SupportedChainId
  partnerId?: string
  publicClient: PublicClient
  walletClient: WalletClient
}

// After
interface YoClientConfig {
  chainId: SupportedChainId
  partnerId?: number
  publicClients?: Partial<Record<SupportedChainId, PublicClient>>
}
```

### Deposit params

```tsx
// Before — direct deposit
interface DepositParams {
  inputToken: Address
  amount: bigint
  fromChainId: number
  toChainId: number
  account: Address
}

// After — prepare pattern
interface PrepareDepositWithApprovalParams {
  vault: Address
  token: Address        // was inputToken
  owner: Address        // was account
  recipient?: Address
  amount: bigint
  slippageBps?: number
  partnerId?: number
  minShares?: bigint
  chainId?: number
}
```

### Redeem params

```tsx
// Before
interface RedeemParams {
  vault: Address
  shares: bigint
  account: Address
}

// After
interface PrepareRedeemWithApprovalParams {
  vault: Address
  shares: bigint
  owner: Address        // was account
  recipient?: Address
  slippageBps?: number
  partnerId?: number
  minAssetsOut?: bigint
}
```

## Query Key Changes

| Old Key                     | New Key                     |
| --------------------------- | --------------------------- |
| `['yo-vault', ...]`         | `['yo-vault-state', ...]`   |
| `['yo-user-position', ...]` | Same (unchanged)            |
| `['yo-user-balance', ...]`  | `['yo-user-position', ...]` |

All new hooks use the `['yo-<feature>', ...params]` pattern. Action hooks invalidate related queries on success.
