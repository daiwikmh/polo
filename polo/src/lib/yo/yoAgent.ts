import { createYoClient, VAULTS, parseTokenAmount, formatTokenAmount } from "@yo-protocol/core";
import type { VaultId } from "@yo-protocol/core";
import { createPublicClient, createWalletClient, http } from "viem";
import { base, mainnet, arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { LogEntry } from "@/types";
import { getYoDecision } from "./yoAgentLlm";

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
  | "IDLE" | "SCANNING" | "DECIDING" | "DEPOSITING" | "REDEEMING" | "MONITORING" | "PAUSED" | "ERROR";

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
  action: "DEPOSIT" | "REDEEM_ALL";
  amountHuman: string;
  simulation: boolean;
  txHash?: string;
  shares?: string;
  assets?: string;
  reason: string;
  timestamp: number;
  error?: string;
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
};

let agentPrivateKey: string | null = null;
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

export function resetYoAgent() {
  if (interval) clearInterval(interval);
  interval = null;
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
  if (["DEPOSITING", "REDEEMING"].includes(state.status)) return;

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
    const agentAddr = privateKeyToAccount(norm as `0x${string}`).address;

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

    // ── DECIDE ──
    state.status = "DECIDING";
    addLog({ timestamp: Date.now(), level: "INFO", message: "Consulting AI decision engine..." });

    const decision = await getYoDecision(positions, tokenBalances, allVaults);

    state.lastSummary = decision.summary;
    addLog({ timestamp: Date.now(), level: "INFO", message: `AI: ${decision.summary}` });

    // ── EXECUTE ──
    const simulation = state.mode === "SIMULATION";

    for (const d of decision.decisions) {
      if (d.action === "SKIP" || d.action === "HOLD") {
        addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vault} (${CHAIN_NAMES[d.chainId]}): HOLD — ${d.reason}` });
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
          } catch (e) {
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [SIM] ${d.vault}: quotePreviewDeposit failed — ${String(e).slice(0, 80)}` });
          }
        } else {
          // ── LIVE: prepare + send ──
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
          } catch (e) {
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [SIM] ${d.vault}: quotePreviewRedeem failed — ${String(e).slice(0, 80)}` });
          }
        } else {
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
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] ${d.vault} redeem failed: ${msg.slice(0, 120)}` });
          }
        }
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
export function startYoAgent(config: {
  privateKey: string;
  pollIntervalMs: number;
  mode: "SIMULATION" | "LIVE";
}) {
  if (["SCANNING", "DEPOSITING", "REDEEMING"].includes(state.status)) {
    addLog({ timestamp: Date.now(), level: "WARN", message: "Agent already running" });
    return;
  }

  agentPrivateKey = config.privateKey;
  state.mode = config.mode;
  state.status = "MONITORING";
  state.uptime = Date.now();

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
