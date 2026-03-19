// Execute trades triggered from Telegram
import { prisma } from "@/lib/db";
import { createYoClient, VAULTS, parseTokenAmount, formatTokenAmount } from "@yo-protocol/core";
import type { VaultId } from "@yo-protocol/core";
import { createPublicClient, createWalletClient, http } from "viem";
import { base, mainnet, arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { executeSessionDeposit, executeSessionRedeem } from "@/lib/biconomy/session";
import type { SessionDetail } from "@biconomy/abstractjs";
import { sendMessage, sendMessageWithButtons, editMessage } from "./bot";

const RPC: Record<number, string> = {
  8453: process.env.BASE_RPC_URL ?? "https://base-mainnet.g.alchemy.com/v2/JtggWORoKiMdZdf8W5fOD",
  1: process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com",
  42161: process.env.ARB_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/v2/JtggWORoKiMdZdf8W5fOD",
};

const VIEM_CHAINS: Record<number, typeof base | typeof mainnet | typeof arbitrum> = {
  8453: base, 1: mainnet, 42161: arbitrum,
};

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

const VAULT_META: Record<string, { decimals: number; symbol: string }> = {
  yoUSD:  { decimals: 6,  symbol: "USDC" },
  yoETH:  { decimals: 18, symbol: "WETH" },
  yoBTC:  { decimals: 8,  symbol: "cbBTC" },
  yoEUR:  { decimals: 6,  symbol: "EURC" },
  yoGOLD: { decimals: 6,  symbol: "XAUt" },
  yoUSDT: { decimals: 6,  symbol: "USDT" },
};

// Preset amounts per vault type
const PRESETS: Record<string, string[]> = {
  USDC:  ["100", "500", "1000"],
  WETH:  ["0.05", "0.1", "0.5"],
  cbBTC: ["0.001", "0.005", "0.01"],
  EURC:  ["100", "500", "1000"],
  XAUt:  ["0.5", "1", "5"],
  USDT:  ["100", "500", "1000"],
};

// Lookup user by chatId
async function getUserByChatId(chatId: string) {
  return prisma.userSession.findFirst({
    where: { telegramChatId: chatId, telegramTradeEnabled: true },
  });
}

// Show amount picker for deposit
export async function handleDepositStart(chatId: string, vaultId: string, chainId: number) {
  const user = await getUserByChatId(chatId);
  if (!user) {
    await sendMessage(chatId, "Trading not enabled. Turn on trading in the Polo dashboard Telegram settings.");
    return;
  }
  if (!user.active) {
    await sendMessage(chatId, "No active Biconomy session. Activate your smart account in the Polo dashboard first.");
    return;
  }

  const meta = VAULT_META[vaultId];
  if (!meta) { await sendMessage(chatId, "Unknown vault."); return; }

  const chain = CHAIN_NAMES[chainId] ?? String(chainId);
  const presets = PRESETS[meta.symbol] ?? ["100", "500", "1000"];

  const buttons = [
    presets.map((amt) => ({
      text: `${amt} ${meta.symbol}`,
      callback_data: `amt:deposit:${vaultId}:${chainId}:${amt}`,
    })),
    [{ text: "Max", callback_data: `amt:deposit:${vaultId}:${chainId}:max` }],
    [{ text: "Cancel", callback_data: "cancel" }],
  ];

  await sendMessageWithButtons(
    chatId,
    `*Deposit into ${vaultId}* (${chain})\nHow much ${meta.symbol} to deposit?`,
    buttons,
  );
}

// Show confirmation for redeem
export async function handleRedeemStart(chatId: string, vaultId: string, chainId: number) {
  const user = await getUserByChatId(chatId);
  if (!user) {
    await sendMessage(chatId, "Trading not enabled. Turn on trading in the Polo dashboard Telegram settings.");
    return;
  }
  if (!user.active) {
    await sendMessage(chatId, "No active Biconomy session. Activate your smart account in the Polo dashboard first.");
    return;
  }

  const chain = CHAIN_NAMES[chainId] ?? String(chainId);

  const buttons = [
    [
      { text: "Confirm Redeem All", callback_data: `exec:redeem:${vaultId}:${chainId}` },
      { text: "Cancel", callback_data: "cancel" },
    ],
  ];

  await sendMessageWithButtons(
    chatId,
    `*Redeem all ${vaultId}* (${chain})\nThis will redeem all your shares. Confirm?`,
    buttons,
  );
}

// Show confirmation after amount selection
export async function handleAmountSelected(
  chatId: string,
  messageId: number,
  action: string,
  vaultId: string,
  chainId: number,
  amount: string,
) {
  const meta = VAULT_META[vaultId];
  if (!meta) return;
  const chain = CHAIN_NAMES[chainId] ?? String(chainId);

  const buttons = [
    [
      { text: "Confirm", callback_data: `exec:${action}:${vaultId}:${chainId}:${amount}` },
      { text: "Cancel", callback_data: "cancel" },
    ],
  ];

  await editMessage(
    chatId,
    messageId,
    `*Confirm ${action}*\n${amount === "max" ? "Max" : amount} ${meta.symbol} into ${vaultId} (${chain})`,
    buttons,
  );
}

// Execute the trade
export async function executeTrade(
  chatId: string,
  messageId: number,
  action: string,
  vaultId: string,
  chainId: number,
  amount?: string,
) {
  const user = await getUserByChatId(chatId);
  if (!user || !user.active) {
    await editMessage(chatId, messageId, "Session expired or trading disabled.");
    return;
  }

  const meta = VAULT_META[vaultId];
  const vaultCfg = VAULTS[vaultId as VaultId];
  if (!meta || !vaultCfg) {
    await editMessage(chatId, messageId, "Unknown vault.");
    return;
  }

  const chain = CHAIN_NAMES[chainId] ?? String(chainId);
  const agentSignerKey = process.env.PRIVATE_KEY;
  if (!agentSignerKey) {
    await editMessage(chatId, messageId, "Server not configured for trading.");
    return;
  }

  await editMessage(chatId, messageId, `Executing ${action} on ${vaultId} (${chain})...`);

  try {
    const norm = agentSignerKey.startsWith("0x") ? agentSignerKey : `0x${agentSignerKey}`;
    const publicClients = {
      1: createPublicClient({ chain: mainnet, transport: http(RPC[1]) }),
      8453: createPublicClient({ chain: base, transport: http(RPC[8453]) }),
      42161: createPublicClient({ chain: arbitrum, transport: http(RPC[42161]) }),
    } as Parameters<typeof createYoClient>[0]["publicClients"];

    const client = createYoClient({ chainId: 8453, partnerId: 9999, publicClients });
    const vaultAddr = vaultCfg.address;
    const tokenAddr = vaultCfg.underlying.address[chainId];
    const sessionDetails = user.sessionDetails as unknown as SessionDetail[];

    if (action === "deposit" && tokenAddr) {
      // Resolve amount
      let depositAmount: bigint;
      if (amount === "max") {
        const tb = await client.getTokenBalance(tokenAddr, user.smartAccountAddress as `0x${string}`);
        depositAmount = tb.balance;
      } else {
        depositAmount = parseTokenAmount(amount ?? "0", meta.decimals);
      }

      if (depositAmount === 0n) {
        await editMessage(chatId, messageId, `No ${meta.symbol} balance to deposit.`);
        return;
      }

      // Session mode on Base
      if (chainId === 8453) {
        const result = await executeSessionDeposit(
          norm as `0x${string}`,
          user.smartAccountAddress as `0x${string}`,
          sessionDetails,
          vaultAddr as `0x${string}`,
          tokenAddr as `0x${string}`,
          depositAmount,
        );

        const amtHuman = formatTokenAmount(depositAmount, meta.decimals);
        await editMessage(
          chatId, messageId,
          `*Deposit complete*\n${amtHuman} ${meta.symbol} into ${vaultId} (${chain})\nTx: \`${result.hash}\``,
        );
      } else {
        // Non-Base: use wallet client directly
        const isPaused = await client.isPaused(vaultAddr);
        if (isPaused) { await editMessage(chatId, messageId, `${vaultId} is paused.`); return; }

        const account = privateKeyToAccount(norm as `0x${string}`);
        const wc = createWalletClient({
          account, chain: VIEM_CHAINS[chainId] ?? base, transport: http(RPC[chainId]),
        });

        const txs = await client.prepareDepositWithApproval({
          vault: vaultAddr, token: tokenAddr,
          owner: account.address, recipient: account.address,
          amount: depositAmount, slippageBps: 50,
        });

        let lastHash: string | undefined;
        for (const tx of txs) {
          const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n, account });
          await client.waitForTransaction(hash, chainId);
          lastHash = hash;
        }

        const amtHuman = formatTokenAmount(depositAmount, meta.decimals);
        await editMessage(
          chatId, messageId,
          `*Deposit complete*\n${amtHuman} ${meta.symbol} into ${vaultId} (${chain})\nTx: \`${lastHash}\``,
        );
      }
    } else if (action === "redeem") {
      // Get shares
      const shares = await client.getShareBalance(vaultAddr, user.smartAccountAddress as `0x${string}`);
      if (shares === 0n) {
        await editMessage(chatId, messageId, `No ${vaultId} shares to redeem.`);
        return;
      }

      if (chainId === 8453) {
        const result = await executeSessionRedeem(
          norm as `0x${string}`,
          user.smartAccountAddress as `0x${string}`,
          sessionDetails,
          vaultAddr as `0x${string}`,
          shares,
        );

        await editMessage(
          chatId, messageId,
          `*Redeem complete*\nAll ${vaultId} shares redeemed (${chain})\nTx: \`${result.hash}\``,
        );
      } else {
        const account = privateKeyToAccount(norm as `0x${string}`);
        const wc = createWalletClient({
          account, chain: VIEM_CHAINS[chainId] ?? base, transport: http(RPC[chainId]),
        });

        const txs = await client.prepareRedeemWithApproval({
          vault: vaultAddr, shares, owner: account.address, recipient: account.address,
        });

        let lastHash: string | undefined;
        for (const tx of txs) {
          const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n, account });
          await client.waitForTransaction(hash, chainId);
          lastHash = hash;
        }

        await editMessage(
          chatId, messageId,
          `*Redeem complete*\nAll ${vaultId} shares redeemed (${chain})\nTx: \`${lastHash}\``,
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await editMessage(chatId, messageId, `Trade failed: ${msg.slice(0, 200)}`);
  }
}
