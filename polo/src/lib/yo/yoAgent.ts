import { createYoClient, VAULTS, parseTokenAmount, formatTokenAmount } from "@yo-protocol/core";
import type { VaultId } from "@yo-protocol/core";
import { createPublicClient, createWalletClient, http } from "viem";
import type { Address, Hex } from "viem";
import { base, mainnet, arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { LogEntry } from "@/types";
import { getYoDecision } from "./yoAgentLlm";
import type { BridgeQuoteContext } from "./yoAgentLlm";
import { YoBridge } from "./lifiBridge";
import { executeSessionDeposit, executeSessionRedeem } from "@/lib/biconomy/session";
import type { SessionDetail } from "@biconomy/abstractjs";
import { notifyTrade, notifyAgentEvent, notifyMarketSummary } from "@/lib/telegram/notifications";

// ─── Chain RPC URLs ───────────────────────────────────────────────────────────
const RPC: Record<number, string> = {
  8453: process.env.BASE_RPC_URL ?? "https://base-mainnet.g.alchemy.com/v2/JtggWORoKiMdZdf8W5fOD",
  1: process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com",
  42161: process.env.ARB_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/v2/JtggWORoKiMdZdf8W5fOD",
};

const VIEM_CHAINS: Record<number, typeof base | typeof mainnet | typeof arbitrum> = {
  8453: base,
  1: mainnet,
  42161: arbitrum,
};

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

// Vaults to manage (from user spec)
const YO_VAULT_IDS: VaultId[] = ["yoUSD", "yoETH", "yoBTC", "yoEUR", "yoGOLD", "yoUSDT"];

// ─── Types ────────────────────────────────────────────────────────────────────
export type YoAgentStatus =
  | "IDLE" | "SCANNING" | "DECIDING" | "DEPOSITING" | "REDEEMING" | "BRIDGING" | "MONITORING" | "PAUSED" | "ERROR";

export interface YoVaultPosition {
  vaultId: string;
  chainId: number;
  shares: string;     // bigint as string
  assetsHuman: string;
  apy7d: string | null;
  apy1d: string | null;
  tvlFormatted: string;
}

export interface YoTokenBalance {
  chainId: number;
  vaultId: string;    // which vault this underlying feeds
  symbol: string;
  balanceRaw: string; // bigint as string
  balanceHuman: string;
}

export interface YoTradeRecord {
  vault: string;
  chainId: number;
  action: "DEPOSIT" | "REDEEM_ALL" | "BRIDGE_AND_DEPOSIT";
  amountHuman: string;
  simulation: boolean;
  txHash?: string;
  shares?: string;
  assets?: string;
  reason: string;
  timestamp: number;
  error?: string;
  bridgeFrom?: number;
  bridgeTxHash?: string;
  bridgeCost?: string;
  bridgeUsed?: string;
}

export interface YoAgentState {
  status: YoAgentStatus;
  mode: "SIMULATION" | "LIVE";
  agentAddress: string;
  logs: LogEntry[];
  uptime: number;
  scansPerformed: number;
  tradesPerformed: number;
  lastScan: number;
  positions: YoVaultPosition[];
  tokenBalances: YoTokenBalance[];
  tradeHistory: YoTradeRecord[];
  lastSummary: string;
  executionMode: "platform" | "session"; // platform = PRIVATE_KEY, session = Biconomy
  userEoa?: string; // user's EOA address when in session mode
}

// Biconomy session context for per-user execution
export interface SessionContext {
  agentSignerKey: Hex;
  userSmartAccountAddress: Address;
  sessionDetails: SessionDetail[];
  userEoa: string;
}

// ─── Module-level singleton ───────────────────────────────────────────────────
let state: YoAgentState = {
  status: "IDLE",
  mode: "SIMULATION",
  agentAddress: "",
  logs: [],
  uptime: 0,
  scansPerformed: 0,
  tradesPerformed: 0,
  lastScan: 0,
  positions: [],
  tokenBalances: [],
  tradeHistory: [],
  lastSummary: "",
  executionMode: "platform",
};

let agentPrivateKey: string | null = null;
let sessionContext: SessionContext | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

function addLog(entry: Omit<LogEntry, "id">) {
  const log: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
  };
  state.logs = [log, ...state.logs].slice(0, 150);
}

export function getYoAgentState(): YoAgentState {
  return { ...state };
}

// Send Telegram notification for a trade (fire and forget)
function telegramNotifyTrade(trade: YoTradeRecord) {
  const eoa = sessionContext?.userEoa ?? state.userEoa;
  if (!eoa) return;
  notifyTrade(eoa, trade).catch(() => {});
}

export function resetYoAgent() {
  if (interval) clearInterval(interval);
  interval = null;
  sessionContext = null;
  state = {
    ...state,
    status: "IDLE",
    logs: [],
    uptime: 0,
    scansPerformed: 0,
    tradesPerformed: 0,
    lastScan: 0,
    positions: [],
    tokenBalances: [],
    tradeHistory: [],
    lastSummary: "",
    executionMode: "platform",
    userEoa: undefined,
  };
}

export function setYoMode(mode: "SIMULATION" | "LIVE") {
  state.mode = mode;
  addLog({
    timestamp: Date.now(),
    level: "WARN",
    message: `Mode → ${mode}${mode === "LIVE" ? " — real transactions enabled" : " — no real trades"}`,
  });
}

export function stopYoAgent() {
  if (interval) { clearInterval(interval); interval = null; }
  state.status = "PAUSED";
  addLog({ timestamp: Date.now(), level: "INFO", message: "YO agent stopped" });
  const eoa = sessionContext?.userEoa ?? state.userEoa;
  if (eoa) notifyAgentEvent(eoa, "stopped").catch(() => {});
}

// ─── Build clients ────────────────────────────────────────────────────────────
function buildPublicClients() {
  return {
    1:     createPublicClient({ chain: mainnet,  transport: http(RPC[1]) }),
    8453:  createPublicClient({ chain: base,     transport: http(RPC[8453]) }),
    42161: createPublicClient({ chain: arbitrum, transport: http(RPC[42161]) }),
  } as Parameters<typeof createYoClient>[0]["publicClients"];
}

function buildWalletClient(pk: string, chainId: number) {
  const norm = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(norm as `0x${string}`);
  const chain = VIEM_CHAINS[chainId] ?? base;
  return createWalletClient({ account, chain, transport: http(RPC[chainId] ?? RPC[8453]) });
}

// ─── Vault registry helpers ───────────────────────────────────────────────────
interface VaultMeta {
  id: VaultId;
  chains: number[];
  decimals: number;
  symbol: string;
}

const VAULT_META: VaultMeta[] = [
  { id: "yoUSD",  chains: [8453, 1, 42161], decimals: 6,  symbol: "USDC"  },
  { id: "yoETH",  chains: [8453, 1],        decimals: 18, symbol: "WETH"  },
  { id: "yoBTC",  chains: [8453, 1],        decimals: 8,  symbol: "cbBTC" },
  { id: "yoEUR",  chains: [8453, 1],        decimals: 6,  symbol: "EURC"  },
  { id: "yoGOLD", chains: [1],              decimals: 6,  symbol: "XAUt"  },
  { id: "yoUSDT", chains: [1],              decimals: 6,  symbol: "USDT"  },
];

// Min amounts before agent acts (avoid dust)
const MIN_DEPOSIT: Record<string, bigint> = {
  USDC:  1_000_000n,           // $1
  WETH:  1_000_000_000_000_000n, // 0.001 ETH
  cbBTC: 10_000n,              // 0.0001 BTC (8 dec)
  EURC:  1_000_000n,           // €1
  XAUt:  100_000n,             // 0.1 XAUt
  USDT:  1_000_000n,           // $1
};

// ─── Main scan & execute cycle ────────────────────────────────────────────────
async function runCycle(pk: string) {
  if (["DEPOSITING", "REDEEMING", "BRIDGING"].includes(state.status)) return;

  try {
    // ── SCAN ──
    state.status = "SCANNING";
    state.scansPerformed++;
    state.lastScan = Date.now();
    addLog({ timestamp: Date.now(), level: "INFO", message: "Scanning YO Protocol vaults across chains..." });

    const publicClients = buildPublicClients();
    const client = createYoClient({ chainId: 8453, partnerId: 9999, publicClients });

    // Fetch vault stats
    let allVaults;
    try {
      allVaults = await client.getVaults({ secondary: true });
    } catch {
      addLog({ timestamp: Date.now(), level: "WARN", message: "getVaults() failed, retrying without secondary..." });
      allVaults = await client.getVaults();
    }

    const norm = pk.startsWith("0x") ? pk : `0x${pk}`;
    // In session mode, scan the user's smart account; in platform mode, scan the agent signer's address
    const agentAddr = sessionContext
      ? sessionContext.userSmartAccountAddress
      : privateKeyToAccount(norm as `0x${string}`).address;

    // ── Gather positions & balances ──
    const positions: YoVaultPosition[] = [];
    const tokenBalances: YoTokenBalance[] = [];

    for (const meta of VAULT_META) {
      const vaultCfg = VAULTS[meta.id];
      if (!vaultCfg) continue;

      for (const chainId of meta.chains) {
        // Share balance in this vault on this chain
        let shares = 0n;
        try {
          shares = await client.getShareBalance(vaultCfg.address, agentAddr);
        } catch { /* skip */ }

        // Estimate assets from shares
        let assetsHuman = "0";
        if (shares > 0n) {
          try {
            const assets = await client.quotePreviewRedeem(vaultCfg.address, shares);
            assetsHuman = formatTokenAmount(assets, meta.decimals);
          } catch { assetsHuman = "~"; }
        }

        // APY + TVL from vault stats
        const vaultStat = allVaults.find(
          (v) => v.chain?.id === chainId && v.id?.toLowerCase() === meta.id.toLowerCase()
        );

        if (shares > 0n || vaultStat) {
          positions.push({
            vaultId: meta.id,
            chainId,
            shares: shares.toString(),
            assetsHuman,
            apy7d: vaultStat?.yield?.["7d"] ?? null,
            apy1d: vaultStat?.yield?.["1d"] ?? null,
            tvlFormatted: vaultStat?.tvl?.formatted ?? "—",
          });

          if (vaultStat) {
            const apy = vaultStat.yield?.["7d"];
            addLog({
              timestamp: Date.now(),
              level: "INFO",
              message: `  [${meta.id}] ${CHAIN_NAMES[chainId]}: ${apy ? `${parseFloat(apy).toFixed(2)}% 7d APY` : "APY n/a"} | TVL ${vaultStat.tvl?.formatted ?? "—"} | Held: ${shares > 0n ? `${assetsHuman} ${meta.symbol}` : "none"}`,
            });
          }
        }

        // Underlying token balance (idle liquidity)
        const tokenAddr = vaultCfg.underlying.address[chainId];
        if (tokenAddr) {
          let tokenBal = 0n;
          try {
            const tb = await client.getTokenBalance(tokenAddr, agentAddr);
            tokenBal = tb.balance;
          } catch { /* skip */ }

          if (tokenBal > 0n) {
            tokenBalances.push({
              chainId,
              vaultId: meta.id,
              symbol: meta.symbol,
              balanceRaw: tokenBal.toString(),
              balanceHuman: formatTokenAmount(tokenBal, meta.decimals),
            });
            addLog({
              timestamp: Date.now(),
              level: "INFO",
              message: `  Idle ${meta.symbol} on ${CHAIN_NAMES[chainId]}: ${formatTokenAmount(tokenBal, meta.decimals)}`,
            });
          }
        }
      }
    }

    state.positions = positions;
    state.tokenBalances = tokenBalances;

    // ── BRIDGE QUOTES (cross-chain opportunities) ──
    const bridgeQuotes: BridgeQuoteContext[] = [];
    const bridge = new YoBridge(pk, agentAddr, (log) => addLog(log));

    for (const bal of tokenBalances) {
      const meta = VAULT_META.find((m) => m.id === bal.vaultId);
      if (!meta) continue;
      const vaultCfg = VAULTS[bal.vaultId as VaultId];
      if (!vaultCfg) continue;

      // Check if a same-chain vault exists with good APY — if so, no need to bridge
      const sameChainVault = allVaults.find(
        (v) => v.id?.toLowerCase() === bal.vaultId.toLowerCase() && v.chain?.id === bal.chainId
      );
      const sameChainApy = sameChainVault?.yield?.["7d"] ? parseFloat(sameChainVault.yield["7d"]) : 0;
      if (sameChainApy > 1.5) continue; // same-chain deposit is better, skip bridge quote

      // Find best APY on a different chain for this vault
      let bestChainId: number | null = null;
      let bestApy = 0;
      for (const chainId of meta.chains) {
        if (chainId === bal.chainId) continue;
        const vs = allVaults.find(
          (v) => v.id?.toLowerCase() === bal.vaultId.toLowerCase() && v.chain?.id === chainId
        );
        const apy = vs?.yield?.["7d"] ? parseFloat(vs.yield["7d"]) : 0;
        if (apy > bestApy) { bestApy = apy; bestChainId = chainId; }
      }

      if (bestChainId && bestApy > 1.5) {
        const toTokenAddr = vaultCfg.underlying.address[bestChainId];
        const fromTokenAddr = vaultCfg.underlying.address[bal.chainId];
        if (!toTokenAddr || !fromTokenAddr) continue;

        try {
          const quote = await bridge.fetchQuoteCost(
            bal.chainId, bestChainId,
            fromTokenAddr, toTokenAddr,
            BigInt(bal.balanceRaw), meta.decimals, meta.symbol
          );
          bridgeQuotes.push({
            fromChainId: bal.chainId,
            toChainId: bestChainId,
            vaultId: bal.vaultId,
            symbol: meta.symbol,
            amountHuman: bal.balanceHuman,
            bridgeName: quote.bridgeName,
            estimatedTime: quote.estimatedTime,
            bridgeCost: quote.bridgeCost,
          });
          addLog({
            timestamp: Date.now(),
            level: "INFO",
            message: `  Bridge quote: ${bal.balanceHuman} ${meta.symbol} ${CHAIN_NAMES[bal.chainId]} → ${CHAIN_NAMES[bestChainId]} via ${quote.bridgeName} (cost: ${quote.bridgeCost.toFixed(4)} ${meta.symbol}, ~${quote.estimatedTime}s)`,
          });
        } catch (e) {
          addLog({
            timestamp: Date.now(),
            level: "WARN",
            message: `  Bridge quote failed ${CHAIN_NAMES[bal.chainId]} → ${CHAIN_NAMES[bestChainId]}: ${String(e).slice(0, 80)}`,
          });
        }
      }
    }

    // ── DECIDE ──
    state.status = "DECIDING";
    addLog({ timestamp: Date.now(), level: "INFO", message: "Consulting AI decision engine..." });

    const decision = await getYoDecision(positions, tokenBalances, allVaults, bridgeQuotes);

    state.lastSummary = decision.summary;
    addLog({ timestamp: Date.now(), level: "INFO", message: `AI: ${decision.summary}` });

    // ── EXECUTE ──
    const simulation = state.mode === "SIMULATION";

    for (const d of decision.decisions) {
      if (d.action === "SKIP" || d.action === "HOLD") {
        addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vault} (${CHAIN_NAMES[d.chainId]}): HOLD — ${d.reason}` });
        continue;
      }

      if (d.action === "OPPORTUNITY") {
        addLog({ timestamp: Date.now(), level: "WARN", message: `  ★ ${d.vault} (${CHAIN_NAMES[d.chainId]}): OPPORTUNITY — ${d.reason}` });
        continue;
      }

      // ── BRIDGE_AND_DEPOSIT ──
      if (d.action === "BRIDGE_AND_DEPOSIT") {
        const bmeta = VAULT_META.find((m) => m.id === d.vault);
        const bvaultCfg = VAULTS[d.vault as VaultId];
        if (!bmeta || !bvaultCfg || !d.sourceChainId || !d.amountHuman) {
          addLog({ timestamp: Date.now(), level: "WARN", message: `  ${d.vault}: BRIDGE_AND_DEPOSIT missing sourceChainId or amountHuman` });
          continue;
        }

        const fromTokenAddr = bvaultCfg.underlying.address[d.sourceChainId];
        const toTokenAddr = bvaultCfg.underlying.address[d.chainId];
        const bvaultAddr = bvaultCfg.address;
        if (!fromTokenAddr || !toTokenAddr) {
          addLog({ timestamp: Date.now(), level: "WARN", message: `  ${d.vault}: no token address for chain pair ${d.sourceChainId} → ${d.chainId}` });
          continue;
        }

        const bridgeAmount = parseTokenAmount(d.amountHuman, bmeta.decimals);
        const minDeposit = MIN_DEPOSIT[bmeta.symbol] ?? 1_000_000n;
        if (bridgeAmount < minDeposit) {
          addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vault}: amount too small to bridge+deposit (${d.amountHuman} ${bmeta.symbol})` });
          continue;
        }

        if (simulation) {
          // ── SIMULATION: dry-run bridge + quote deposit ──
          try {
            state.status = "BRIDGING";
            const dryRun = await bridge.getDryRunQuote(
              d.sourceChainId, d.chainId,
              fromTokenAddr, toTokenAddr,
              bridgeAmount, bmeta.decimals, bmeta.symbol
            );

            // Simulate deposit with estimated bridge output
            state.status = "DEPOSITING";
            const estimatedReceived = BigInt(dryRun.estimatedOutput);
            let sharesHuman = "~";
            try {
              const expectedShares = await client.quotePreviewDeposit(bvaultAddr, estimatedReceived);
              sharesHuman = formatTokenAmount(expectedShares, 18);
            } catch { /* preview may fail for cross-chain amounts */ }

            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `  [SIM] ${d.vault}: Would bridge ${d.amountHuman} ${bmeta.symbol} from ${CHAIN_NAMES[d.sourceChainId]} → ${CHAIN_NAMES[d.chainId]} (cost: ${dryRun.bridgeCost.toFixed(4)} ${bmeta.symbol}, ~${dryRun.estimatedTime}s) then deposit → ~${sharesHuman} shares | ${d.reason}`,
            });
            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "BRIDGE_AND_DEPOSIT",
              amountHuman: d.amountHuman, simulation: true,
              shares: sharesHuman, reason: d.reason, timestamp: Date.now(),
              bridgeFrom: d.sourceChainId,
              bridgeCost: dryRun.bridgeCost.toFixed(4),
              bridgeUsed: dryRun.bridgeName,
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
          } catch (e) {
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [SIM] ${d.vault}: bridge dry-run failed — ${String(e).slice(0, 100)}` });
          }
        } else {
          // ── LIVE: bridge → verify arrival → deposit ──
          try {
            state.status = "BRIDGING";
            addLog({
              timestamp: Date.now(),
              level: "WARN",
              message: `  [LIVE] Bridging ${d.amountHuman} ${bmeta.symbol} from ${CHAIN_NAMES[d.sourceChainId]} → ${CHAIN_NAMES[d.chainId]}...`,
            });

            // Get balance before bridge for arrival verification
            let beforeBalance = 0n;
            try {
              const tb = await client.getTokenBalance(toTokenAddr, agentAddr);
              beforeBalance = tb.balance;
            } catch { /* ok */ }

            const bridgeResult = await bridge.executeBridge(
              d.sourceChainId, d.chainId,
              fromTokenAddr, toTokenAddr,
              bridgeAmount, bmeta.decimals, bmeta.symbol
            );

            // Verify token arrival on target chain (max 5 min, check every 15s)
            addLog({ timestamp: Date.now(), level: "INFO", message: `  Waiting for tokens to arrive on ${CHAIN_NAMES[d.chainId]}...` });
            let arrivedAmount = 0n;
            for (let i = 0; i < 20; i++) {
              try {
                const tb = await client.getTokenBalance(toTokenAddr, agentAddr);
                if (tb.balance > beforeBalance) {
                  arrivedAmount = tb.balance - beforeBalance;
                  break;
                }
              } catch { /* retry */ }
              await new Promise((r) => setTimeout(r, 15_000));
            }

            if (arrivedAmount === 0n) {
              addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] Bridge tokens not arrived after 5min — skipping deposit, will retry next cycle` });
              state.tradeHistory.push({
                vault: d.vault, chainId: d.chainId, action: "BRIDGE_AND_DEPOSIT",
                amountHuman: d.amountHuman, simulation: false,
                reason: d.reason, timestamp: Date.now(),
                bridgeFrom: d.sourceChainId,
                bridgeUsed: bridgeResult.bridgeUsed,
                error: "Bridge tokens not arrived after 5min",
              });
              continue;
            }

            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `  Bridge complete — ${formatTokenAmount(arrivedAmount, bmeta.decimals)} ${bmeta.symbol} arrived on ${CHAIN_NAMES[d.chainId]}`,
            });

            // Now deposit the arrived tokens
            state.status = "DEPOSITING";
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [LIVE] Depositing bridged ${bmeta.symbol} into ${d.vault} on ${CHAIN_NAMES[d.chainId]}...` });

            const isPaused = await client.isPaused(bvaultAddr);
            if (isPaused) {
              addLog({ timestamp: Date.now(), level: "ERROR", message: `  ${d.vault}: vault is paused — skipping deposit after bridge` });
              continue;
            }

            const txs = await client.prepareDepositWithApproval({
              vault: bvaultAddr,
              token: toTokenAddr,
              owner: agentAddr,
              recipient: agentAddr,
              amount: arrivedAmount,
              slippageBps: 50,
            });

            const wc = buildWalletClient(pk, d.chainId);
            let lastHash: `0x${string}` | undefined;
            for (const tx of txs) {
              const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n, account: wc.account! });
              addLog({ timestamp: Date.now(), level: "INFO", message: `  tx: ${hash}` });
              await client.waitForTransaction(hash, d.chainId);
              lastHash = hash;
            }

            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "BRIDGE_AND_DEPOSIT",
              amountHuman: formatTokenAmount(arrivedAmount, bmeta.decimals),
              simulation: false, txHash: lastHash,
              reason: d.reason, timestamp: Date.now(),
              bridgeFrom: d.sourceChainId,
              bridgeCost: ((Number(bridgeAmount) - Number(arrivedAmount)) / 10 ** bmeta.decimals).toFixed(4),
              bridgeUsed: bridgeResult.bridgeUsed,
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `  [LIVE] ${d.vault}: bridged + deposited ${formatTokenAmount(arrivedAmount, bmeta.decimals)} ${bmeta.symbol} ✓`,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] ${d.vault} bridge+deposit failed: ${msg.slice(0, 120)}` });
          }
        }
        continue;
      }

      const meta = VAULT_META.find((m) => m.id === d.vault);
      const vaultCfg = VAULTS[d.vault as VaultId];
      if (!meta || !vaultCfg) continue;

      const vaultAddr = vaultCfg.address;
      const tokenAddr = vaultCfg.underlying.address[d.chainId];

      if (d.action === "DEPOSIT") {
        if (!d.amountHuman || !tokenAddr) continue;

        const amount = parseTokenAmount(d.amountHuman, meta.decimals);
        const minDeposit = MIN_DEPOSIT[meta.symbol] ?? 1_000_000n;
        if (amount < minDeposit) {
          addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vault}: amount too small to deposit (${d.amountHuman} ${meta.symbol})` });
          continue;
        }

        if (simulation) {
          // ── SIMULATION: quote only ──
          try {
            state.status = "DEPOSITING";
            const expectedShares = await client.quotePreviewDeposit(vaultAddr, amount);
            const sharesHuman = formatTokenAmount(expectedShares, 18); // shares are 18 dec
            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `  [SIM] ${d.vault} (${CHAIN_NAMES[d.chainId]}): Would deposit ${d.amountHuman} ${meta.symbol} → ~${sharesHuman} shares | ${d.reason}`,
            });
            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "DEPOSIT",
              amountHuman: d.amountHuman, simulation: true,
              shares: sharesHuman, reason: d.reason, timestamp: Date.now(),
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
          } catch (e) {
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [SIM] ${d.vault}: quotePreviewDeposit failed — ${String(e).slice(0, 80)}` });
          }
        } else if (sessionContext && d.chainId === 8453) {
          // ── LIVE (Biconomy session): execute via MEE client ──
          try {
            state.status = "DEPOSITING";
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [LIVE·SESSION] Depositing ${d.amountHuman} ${meta.symbol} into ${d.vault} via smart account...` });

            const isPaused = await client.isPaused(vaultAddr);
            if (isPaused) {
              addLog({ timestamp: Date.now(), level: "ERROR", message: `  ${d.vault}: vault is paused — skipping` });
              continue;
            }

            const result = await executeSessionDeposit(
              sessionContext.agentSignerKey,
              sessionContext.userSmartAccountAddress,
              sessionContext.sessionDetails,
              vaultAddr as `0x${string}`,
              tokenAddr as `0x${string}`,
              amount,
            );

            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "DEPOSIT",
              amountHuman: d.amountHuman, simulation: false,
              txHash: result.hash, reason: d.reason, timestamp: Date.now(),
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
            addLog({ timestamp: Date.now(), level: "SUCCESS", message: `  [LIVE·SESSION] ${d.vault}: deposited ${d.amountHuman} ${meta.symbol} via smart account ✓` });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE·SESSION] ${d.vault} deposit failed: ${msg.slice(0, 120)}` });
          }
        } else {
          // ── LIVE (platform key): prepare + send ──
          try {
            state.status = "DEPOSITING";
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [LIVE] Depositing ${d.amountHuman} ${meta.symbol} into ${d.vault} on ${CHAIN_NAMES[d.chainId]}...` });

            const isPaused = await client.isPaused(vaultAddr);
            if (isPaused) {
              addLog({ timestamp: Date.now(), level: "ERROR", message: `  ${d.vault}: vault is paused — skipping` });
              continue;
            }

            const txs = await client.prepareDepositWithApproval({
              vault: vaultAddr,
              token: tokenAddr,
              owner: agentAddr,
              recipient: agentAddr,
              amount,
              slippageBps: 50,
            });

            const wc = buildWalletClient(pk, d.chainId);
            let lastHash: `0x${string}` | undefined;
            for (const tx of txs) {
              const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n, account: wc.account! });
              addLog({ timestamp: Date.now(), level: "INFO", message: `  tx: ${hash}` });
              await client.waitForTransaction(hash, d.chainId);
              lastHash = hash;
            }

            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "DEPOSIT",
              amountHuman: d.amountHuman, simulation: false,
              txHash: lastHash, reason: d.reason, timestamp: Date.now(),
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
            addLog({ timestamp: Date.now(), level: "SUCCESS", message: `  [LIVE] ${d.vault}: deposited ${d.amountHuman} ${meta.symbol} ✓` });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] ${d.vault} deposit failed: ${msg.slice(0, 120)}` });
          }
        }
      } else if (d.action === "REDEEM_ALL") {
        const pos = positions.find((p) => p.vaultId === d.vault && p.chainId === d.chainId);
        if (!pos || pos.shares === "0") {
          addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vault}: no shares to redeem` });
          continue;
        }

        const shares = BigInt(pos.shares);

        if (simulation) {
          try {
            state.status = "REDEEMING";
            const expectedAssets = await client.quotePreviewRedeem(vaultAddr, shares);
            const assetsHuman = formatTokenAmount(expectedAssets, meta.decimals);
            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `  [SIM] ${d.vault} (${CHAIN_NAMES[d.chainId]}): Would redeem all shares → ~${assetsHuman} ${meta.symbol} | ${d.reason}`,
            });
            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "REDEEM_ALL",
              amountHuman: assetsHuman, simulation: true,
              assets: assetsHuman, reason: d.reason, timestamp: Date.now(),
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
          } catch (e) {
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [SIM] ${d.vault}: quotePreviewRedeem failed — ${String(e).slice(0, 80)}` });
          }
        } else if (sessionContext && d.chainId === 8453) {
          // ── LIVE (Biconomy session): redeem via MEE client ──
          try {
            state.status = "REDEEMING";
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [LIVE·SESSION] Redeeming all ${d.vault} shares via smart account...` });

            const result = await executeSessionRedeem(
              sessionContext.agentSignerKey,
              sessionContext.userSmartAccountAddress,
              sessionContext.sessionDetails,
              vaultAddr as `0x${string}`,
              shares,
            );

            state.tradeHistory.push({
              vault: d.vault, chainId: d.chainId, action: "REDEEM_ALL",
              amountHuman: "redeemed", simulation: false,
              txHash: result.hash, reason: d.reason, timestamp: Date.now(),
            });
            state.tradesPerformed++;
            telegramNotifyTrade(state.tradeHistory[0]);
            addLog({ timestamp: Date.now(), level: "SUCCESS", message: `  [LIVE·SESSION] ${d.vault}: redeemed all shares via smart account ✓` });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE·SESSION] ${d.vault} redeem failed: ${msg.slice(0, 120)}` });
          }
        } else {
          // ── LIVE (platform key): prepare + send ──
          try {
            state.status = "REDEEMING";
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [LIVE] Redeeming all ${d.vault} shares on ${CHAIN_NAMES[d.chainId]}...` });

            const txs = await client.prepareRedeemWithApproval({
              vault: vaultAddr,
              shares,
              owner: agentAddr,
              recipient: agentAddr,
            });

            const wc = buildWalletClient(pk, d.chainId);
            let redeemHash: `0x${string}` | undefined;
            for (const tx of txs) {
              const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n, account: wc.account! });
              addLog({ timestamp: Date.now(), level: "INFO", message: `  tx: ${hash}` });
              await client.waitForTransaction(hash, d.chainId);
              redeemHash = hash;
            }

            if (redeemHash) {
              const receipt = await client.waitForRedeemReceipt(redeemHash, d.chainId);
              const assetsHuman = formatTokenAmount(receipt.assetsOrRequestId as bigint, meta.decimals);
              addLog({
                timestamp: Date.now(),
                level: "SUCCESS",
                message: receipt.instant
                  ? `  [LIVE] ${d.vault}: redeemed → ${assetsHuman} ${meta.symbol} ✓`
                  : `  [LIVE] ${d.vault}: queued redeem — request ID: ${receipt.assetsOrRequestId}`,
              });
              state.tradeHistory.push({
                vault: d.vault, chainId: d.chainId, action: "REDEEM_ALL",
                amountHuman: receipt.instant ? assetsHuman : "queued",
                simulation: false, txHash: redeemHash,
                assets: assetsHuman, reason: d.reason, timestamp: Date.now(),
              });
              state.tradesPerformed++;
              telegramNotifyTrade(state.tradeHistory[0]);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] ${d.vault} redeem failed: ${msg.slice(0, 120)}` });
          }
        }
      }
    }

    // Send best yields via Telegram each cycle
    const eoa = sessionContext?.userEoa ?? state.userEoa;
    if (eoa && positions.length > 0) {
      const best = positions
        .filter((p) => p.apy7d)
        .sort((a, b) => parseFloat(b.apy7d!) - parseFloat(a.apy7d!))
        .slice(0, 6);
      if (best.length > 0) {
        const vaultSummary = best.map((p) => {
          const meta = VAULT_META.find((m) => m.id === p.vaultId);
          return { id: p.vaultId, apy7d: p.apy7d, symbol: meta?.symbol ?? "", chainId: p.chainId };
        });
        notifyMarketSummary(eoa, vaultSummary).catch(() => {});
      }
    }

    state.status = "MONITORING";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addLog({ timestamp: Date.now(), level: "ERROR", message: message.slice(0, 200) });
    state.status = "MONITORING";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Start agent in platform mode (uses PRIVATE_KEY for its own wallet)
export function startYoAgent(config: {
  privateKey: string;
  pollIntervalMs: number;
  mode: "SIMULATION" | "LIVE";
  userEoa?: string;
}) {
  if (["SCANNING", "DEPOSITING", "REDEEMING", "BRIDGING"].includes(state.status)) {
    addLog({ timestamp: Date.now(), level: "WARN", message: "Agent already running" });
    return;
  }

  agentPrivateKey = config.privateKey;
  sessionContext = null;
  state.mode = config.mode;
  state.status = "MONITORING";
  state.uptime = Date.now();
  state.executionMode = "platform";
  state.userEoa = config.userEoa;

  const norm = config.privateKey.startsWith("0x") ? config.privateKey : `0x${config.privateKey}`;
  state.agentAddress = privateKeyToAccount(norm as `0x${string}`).address;

  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `YO agent started [${config.mode}] — scanning every ${config.pollIntervalMs / 1000}s`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Agent wallet: ${state.agentAddress.slice(0, 8)}...${state.agentAddress.slice(-4)}`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Vaults: yoUSD (Base/ETH/ARB) | yoETH (Base/ETH) | yoBTC (Base/ETH) | yoEUR (Base/ETH) | yoGOLD (ETH) | yoUSDT (ETH)`,
  });

  if (config.userEoa) notifyAgentEvent(config.userEoa, "started", config.mode).catch(() => {});

  runCycle(config.privateKey).catch((e) => {
    addLog({ timestamp: Date.now(), level: "ERROR", message: String(e).slice(0, 150) });
    state.status = "MONITORING";
  });
  interval = setInterval(() => {
    runCycle(config.privateKey).catch((e) => {
      addLog({ timestamp: Date.now(), level: "ERROR", message: String(e).slice(0, 150) });
      state.status = "MONITORING";
    });
  }, config.pollIntervalMs);
}

// Start agent in session mode (uses Biconomy session keys for a user's smart account)
export function startYoAgentWithSession(config: {
  agentSignerKey: string;
  userSmartAccountAddress: string;
  userEoa: string;
  sessionDetails: SessionDetail[];
  pollIntervalMs: number;
  mode: "SIMULATION" | "LIVE";
}) {
  if (["SCANNING", "DEPOSITING", "REDEEMING", "BRIDGING"].includes(state.status)) {
    addLog({ timestamp: Date.now(), level: "WARN", message: "Agent already running" });
    return;
  }

  const norm = config.agentSignerKey.startsWith("0x") ? config.agentSignerKey : `0x${config.agentSignerKey}`;

  // Set up session context for execution
  sessionContext = {
    agentSignerKey: norm as `0x${string}`,
    userSmartAccountAddress: config.userSmartAccountAddress as `0x${string}`,
    sessionDetails: config.sessionDetails,
    userEoa: config.userEoa,
  };

  // We still need a private key for scanning (reading balances) — use the agent signer
  agentPrivateKey = norm;
  state.mode = config.mode;
  state.status = "MONITORING";
  state.uptime = Date.now();
  state.executionMode = "session";
  state.userEoa = config.userEoa;
  state.agentAddress = config.userSmartAccountAddress; // Show the user's smart account

  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `YO agent started [${config.mode}·SESSION] — scanning every ${config.pollIntervalMs / 1000}s`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Smart Account: ${config.userSmartAccountAddress.slice(0, 10)}…${config.userSmartAccountAddress.slice(-6)}`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `User EOA: ${config.userEoa.slice(0, 10)}…${config.userEoa.slice(-6)}`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Execution: Biconomy MEE session keys · Base only`,
  });

  notifyAgentEvent(config.userEoa, "started", config.mode).catch(() => {});

  // In session mode, runCycle still scans using the smart account address
  // but executes via Biconomy session keys instead of private key wallet
  runCycle(norm).catch((e) => {
    addLog({ timestamp: Date.now(), level: "ERROR", message: String(e).slice(0, 150) });
    state.status = "MONITORING";
  });
  interval = setInterval(() => {
    runCycle(norm).catch((e) => {
      addLog({ timestamp: Date.now(), level: "ERROR", message: String(e).slice(0, 150) });
      state.status = "MONITORING";
    });
  }, config.pollIntervalMs);
}
