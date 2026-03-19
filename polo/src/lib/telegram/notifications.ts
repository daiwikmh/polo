// Telegram notification formatters for agent events
import { sendMessage, sendMessageWithButtons } from "./bot";
import { prisma } from "@/lib/db";

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

// Lookup user session for telegram
async function getSession(eoaAddress: string) {
  return prisma.userSession.findUnique({
    where: { eoaAddress: eoaAddress.toLowerCase() },
    select: { telegramChatId: true, telegramTradeEnabled: true, active: true },
  });
}

// Send trade notification after yielder executes
export async function notifyTrade(
  eoaAddress: string,
  trade: {
    vault: string;
    chainId: number;
    action: string;
    amountHuman: string;
    simulation: boolean;
    txHash?: string;
    reason: string;
  },
) {
  const session = await getSession(eoaAddress);
  if (!session?.telegramChatId) return;

  const chain = CHAIN_NAMES[trade.chainId] ?? String(trade.chainId);
  const tag = trade.simulation ? "[SIM] " : "";
  const tx = trade.txHash ? `\nTx: \`${trade.txHash.slice(0, 10)}...${trade.txHash.slice(-6)}\`` : "";

  const msg = `*Polo Agent*\n${tag}${trade.action} executed\nVault: ${trade.vault} (${chain})\nAmount: ${trade.amountHuman}${tx}\n_${trade.reason}_`;
  await sendMessage(session.telegramChatId, msg);
}

// Send evacuation alert from guardian
export async function notifyEvacuation(
  eoaAddress: string,
  evac: {
    vaultId: string;
    chainId: number;
    assetsRedeemed: string;
    simulation: boolean;
    reason: string;
  },
) {
  const session = await getSession(eoaAddress);
  if (!session?.telegramChatId) return;

  const chain = CHAIN_NAMES[evac.chainId] ?? String(evac.chainId);
  const tag = evac.simulation ? "[SIM] " : "";

  const msg = `*ALERT — Polo Guardian*\n${tag}Emergency redeem triggered\nVault: ${evac.vaultId} (${chain})\nRecovered: ${evac.assetsRedeemed}\n_${evac.reason}_`;
  await sendMessage(session.telegramChatId, msg);
}

// Send vault market summary with trade buttons if enabled
export async function notifyMarketSummary(
  eoaAddress: string,
  vaults: { id: string; apy7d: string | null; symbol: string; chainId: number }[],
) {
  const session = await getSession(eoaAddress);
  if (!session?.telegramChatId) return;

  const lines = vaults.map((v) => {
    const apy = v.apy7d ? `${parseFloat(v.apy7d).toFixed(2)}%` : "n/a";
    const chain = CHAIN_NAMES[v.chainId] ?? String(v.chainId);
    return `${v.id}  ${apy}  ${v.symbol}  ${chain}`;
  });

  const msg = `*Polo — Vault Snapshot*\nBest APY right now:\n\`\`\`\n${lines.join("\n")}\n\`\`\``;

  // If trading enabled and user has active session, show trade buttons
  if (session.telegramTradeEnabled && session.active) {
    const buttons = vaults.slice(0, 4).map((v) => ([
      { text: `Deposit ${v.id}`, callback_data: `deposit:${v.id}:${v.chainId}` },
      { text: `Redeem ${v.id}`, callback_data: `redeem:${v.id}:${v.chainId}` },
    ]));
    await sendMessageWithButtons(session.telegramChatId, msg, buttons);
  } else {
    await sendMessage(session.telegramChatId, msg);
  }
}

// Notify agent started/stopped
export async function notifyAgentEvent(eoaAddress: string, event: "started" | "stopped", mode?: string) {
  const session = await getSession(eoaAddress);
  if (!session?.telegramChatId) return;

  const msg = event === "started"
    ? `*Polo Agent*\nAgent ${event} in ${mode ?? "SIMULATION"} mode`
    : `*Polo Agent*\nAgent ${event}`;
  await sendMessage(session.telegramChatId, msg);
}

// Send confirmation when Telegram is linked
export async function notifyLinked(chatId: string) {
  const msg = `*Polo*\nTelegram connected. You will receive trade alerts and vault updates here.`;
  await sendMessage(chatId, msg);
}
