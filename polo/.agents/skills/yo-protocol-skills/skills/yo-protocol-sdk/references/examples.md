# Workflow Examples

## Deposit into a Vault (Prepare + Send)

Use `prepareDepositWithApproval()` — it checks allowance and returns the necessary transactions.

```ts
import { createYoClient, VAULTS, parseTokenAmount } from '@yo-protocol/core'
import { createWalletClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createYoClient({ chainId: 8453, partnerId: 9999 })

// 1. Check vault state
const vault = VAULTS.yoUSD
const paused = await client.isPaused(vault.address)
if (paused) throw new Error('Vault is paused')

// 2. Parse amount (100 USDC)
const token = vault.underlying.address[8453]  // USDC on Base
const amount = parseTokenAmount('100', vault.underlying.decimals) // 100_000_000n

// 3. Prepare transactions (handles allowance check internally)
const txs = await client.prepareDepositWithApproval({
  vault: vault.address,
  token,
  owner: userAddress,
  recipient: userAddress,
  amount,
  slippageBps: 50,
})

// 4. Send each transaction sequentially
for (const tx of txs) {
  const hash = await walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
  })
  // Wait for confirmation before sending next tx
  await client.waitForTransaction(hash)
}
```

## Redeem from a Vault

```ts
const vault = VAULTS.yoETH

// Get user's share balance
const shares = await client.getShareBalance(vault.address, userAddress)

// Prepare redeem (handles share approval if needed)
const txs = await client.prepareRedeemWithApproval({
  vault: vault.address,
  shares,
  owner: userAddress,
  recipient: userAddress,
})

// Send transactions
let redeemHash
for (const tx of txs) {
  redeemHash = await walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
  })
  await client.waitForTransaction(redeemHash)
}

// Decode redeem receipt
const receipt = await client.waitForRedeemReceipt(redeemHash)

if (receipt.instant) {
  console.log('Received assets:', receipt.assetsOrRequestId)
} else {
  console.log('Queued. Request ID:', receipt.assetsOrRequestId)
  const pending = await client.getPendingRedemptions(vault.address, userAddress)
  console.log('Pending:', pending)
}
```

## Check All User Positions

```ts
import { formatTokenAmount } from '@yo-protocol/core'

const client = createYoClient({ chainId: 8453 })
const vaults = client.getVaults() // vaults available on Base

for (const vault of vaults) {
  const position = await client.getUserPosition(vault.address, userAddress)
  if (position.shares > 0n) {
    console.log(`${vault.symbol}: ${formatTokenAmount(position.assets, vault.underlying.decimals)} ${vault.underlying.symbol}`)
  }
}
```

## Multi-Chain Positions

```ts
const client = createYoClient({ chainId: 8453 })

// Fetch positions across all chains via multicall
const stats = await client.getVaultStats()
const positions = await client.getUserPositionsAllChains(userAddress, stats)

for (const { vault, position } of positions) {
  if (position.shares > 0n) {
    console.log(`${vault.name}: ${position.assets} assets`)
  }
}
```

## Query Vault Performance (API)

```ts
const client = createYoClient({ chainId: 1 })

const snapshot = await client.getVaultSnapshot(VAULTS.yoUSD.address)
console.log('TVL:', snapshot.stats.tvl.formatted)
console.log('7d yield:', snapshot.stats.yield['7d'])

const yieldHistory = await client.getVaultYieldHistory(VAULTS.yoUSD.address)
const tvlHistory = await client.getVaultTvlHistory(VAULTS.yoUSD.address)
```

## User Performance & History

```ts
const perf = await client.getUserPerformance(VAULTS.yoUSD.address, userAddress)
console.log('Realized P&L:', perf.realized.formatted)
console.log('Unrealized P&L:', perf.unrealized.formatted)

const history = await client.getUserHistory(VAULTS.yoUSD.address, userAddress, 10)
for (const item of history) {
  console.log(`${item.type} | ${item.assets.formatted} | ${item.txHash}`)
}
```

## Claim Merkl Rewards (Base only)

```ts
const client = createYoClient({ chainId: 8453 })

// 1. Check for claimable rewards (merges API + on-chain data)
const rewards = await client.getClaimableRewards(userAddress)
if (!rewards || !client.hasMerklClaimableRewards(rewards)) {
  console.log('No claimable rewards')
  return
}

// 2. Inspect claimable amounts
const totalClaimable = client.getMerklTotalClaimable(rewards)
console.log('Total claimable:', totalClaimable)

// 3. Prepare claim transaction
const tx = client.prepareClaimMerklRewards(userAddress, rewards)

// 4. Send via wallet
const hash = await walletClient.sendTransaction({
  to: tx.to,
  data: tx.data,
  value: tx.value,
})
console.log('Claim tx:', hash)
```

## Prepared Transactions (Safe / Account Abstraction)

For multisig or batched execution — get raw calldata without sending.

```ts
import { createYoClient, VAULTS, parseTokenAmount } from '@yo-protocol/core'

const client = createYoClient({ chainId: 1 })
const vault = VAULTS.yoUSD
const amount = parseTokenAmount('1000', 6)

// Option A: Use prepareDepositWithApproval (checks allowance, returns 1-2 txs)
const txs = await client.prepareDepositWithApproval({
  vault: vault.address,
  token: vault.underlying.address[1],
  owner: safeAddress,
  recipient: safeAddress,
  amount,
})

// Submit all txs to Safe as a batch
await safeSdk.createTransaction({ safeTransactionData: txs })

// Option B: Build approve + deposit separately (for manual control)
const approveTx = client.prepareApprove({
  token: vault.underlying.address[1],
  amount,
})
const depositTx = await client.prepareDeposit({
  vault: vault.address,
  amount,
  recipient: safeAddress,
})
await safeSdk.createTransaction({ safeTransactionData: [approveTx, depositTx] })

// Prepare redeem
const redeemTxs = await client.prepareRedeemWithApproval({
  vault: vault.address,
  shares: 1000000n,
  owner: safeAddress,
  recipient: safeAddress,
})
await safeSdk.createTransaction({ safeTransactionData: redeemTxs })
```

Each `PreparedTransaction` has: `{ to: Address, data: Hex, value: bigint }`.

## Multi-Chain Setup

```ts
import { createPublicClient, http } from 'viem'
import { mainnet, base, arbitrum } from 'viem/chains'

// Single client with multi-chain support
const client = createYoClient({
  chainId: 8453,
  publicClients: {
    1: createPublicClient({ chain: mainnet, transport: http('https://eth-rpc.example.com') }),
    8453: createPublicClient({ chain: base, transport: http('https://base-rpc.example.com') }),
    42161: createPublicClient({ chain: arbitrum, transport: http('https://arb-rpc.example.com') }),
  },
})

// Deposit on a specific chain using chainId param
const txs = await client.prepareDepositWithApproval({
  vault: VAULTS.yoUSD.address,
  token: VAULTS.yoUSD.underlying.address[42161], // USDC on Arbitrum
  owner: userAddress,
  recipient: userAddress,
  amount: 1_000_000n,
  chainId: 42161, // uses the Arbitrum PublicClient
})

// Note: underlying token addresses differ per chain!
// Ethereum USDC: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
// Base USDC:     0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
// Arbitrum USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
```
