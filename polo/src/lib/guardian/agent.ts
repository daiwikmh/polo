// YO Vault Guardian Agent
//
// Monitors vault health (share price, paused state, APY anomalies, TVL)
// and triggers emergency redeems when risk is critical.
//
// Runs independently alongside the yielder agent — the yielder optimizes
// yield, the guardian protects capital.

import { createYoClient, VAULTS, formatTokenAmount } from "@yo-protocol/core";
import type { VaultId } from "@yo-protocol/core";
import { createPublicClient, createWalletClient, http } from "viem";
import { base, mainnet, arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { LogEntry } from "@/types";
import { VaultGuardianMonitor } from "./monitor";
import type { GuardianSnapshot, VaultRiskAssessment } from "./monitor";
import { getGuardianDecision } from "./llm";
import { notifyEvacuation } from "@/lib/telegram/notifications";

// ─── Config ──────────────────────────────────────────────────────────────────
const RPC: Record<number, string> = {
  8453: process.env.BASE_RPC_URL ?? "https://base-mainnet.g.alchemy.com/v2/t7Oxw5b_OpDL6yQVWN70ZjxO6hTCaZeW",
  1: process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com",
  42161: process.env.ARB_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/v2/t7Oxw5b_OpDL6yQVWN70ZjxO6hTCaZeW",
};

const VIEM_CHAINS: Record<number, typeof base | typeof mainnet | typeof arbitrum> = { 8453: base, 1: mainnet, 42161: arbitrum };
const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

const VAULT_META = [
  { id: "yoUSD" as VaultId,  chains: [8453, 1, 42161], decimals: 6,  symbol: "USDC" },
  { id: "yoETH" as VaultId,  chains: [8453, 1],        decimals: 18, symbol: "WETH" },
  { id: "yoBTC" as VaultId,  chains: [8453, 1],        decimals: 8,  symbol: "cbBTC" },
  { id: "yoEUR" as VaultId,  chains: [8453, 1],        decimals: 6,  symbol: "EURC" },
  { id: "yoGOLD" as VaultId, chains: [1],              decimals: 6,  symbol: "XAUt" },
  { id: "yoUSDT" as VaultId, chains: [1],              decimals: 6,  symbol: "USDT" },
];

// ─── Types ───────────────────────────────────────────────────────────────────
export type GuardianStatus =
  | "IDLE" | "SCANNING" | "EVALUATING" | "EVACUATING" | "MONITORING" | "PAUSED" | "ERROR";

export interface GuardianEvacRecord {
  vaultId: string;
  chainId: number;
  assetsRedeemed: string;
  simulation: boolean;
  txHash?: string;
  reason: string;
  timestamp: number;
  error?: string;
}

export interface GuardianAgentState {
  status: GuardianStatus;
  mode: "SIMULATION" | "LIVE";
  agentAddress: string;
  logs: LogEntry[];
  uptime: number;
  scansPerformed: number;
  evacuationsPerformed: number;
  lastScan: number;
  lastSnapshot: GuardianSnapshot | null;
  evacuationHistory: GuardianEvacRecord[];
  lastSummary: string;
}

// ─── Singleton state ─────────────────────────────────────────────────────────
let state: GuardianAgentState = {
  status: "IDLE",
  mode: "SIMULATION",
  agentAddress: "",
  logs: [],
  uptime: 0,
  scansPerformed: 0,
  evacuationsPerformed: 0,
  lastScan: 0,
  lastSnapshot: null,
  evacuationHistory: [],
  lastSummary: "",
};

let interval: ReturnType<typeof setInterval> | null = null;
let guardianUserEoa: string | null = null;

function addLog(entry: Omit<LogEntry, "id">) {
  const log: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
  };
  state.logs = [log, ...state.logs].slice(0, 150);
}

export function getGuardianAgentState(): GuardianAgentState {
  return { ...state };
}

export function resetGuardianAgent() {
  if (interval) clearInterval(interval);
  interval = null;
  state = {
    ...state,
    status: "IDLE",
    logs: [],
    uptime: 0,
    scansPerformed: 0,
    evacuationsPerformed: 0,
    lastScan: 0,
    lastSnapshot: null,
    evacuationHistory: [],
    lastSummary: "",
  };
}

export function setGuardianMode(mode: "SIMULATION" | "LIVE") {
  state.mode = mode;
  addLog({
    timestamp: Date.now(),
    level: "WARN",
    message: `Guardian mode → ${mode}${mode === "LIVE" ? " — real evacuations enabled" : " — simulation only"}`,
  });
}

export function stopGuardianAgent() {
  if (interval) { clearInterval(interval); interval = null; }
  state.status = "PAUSED";
  addLog({ timestamp: Date.now(), level: "INFO", message: "Guardian agent stopped" });
}

// ─── Build clients ───────────────────────────────────────────────────────────
function buildPublicClients() {
  return {
    1: createPublicClient({ chain: mainnet, transport: http(RPC[1]) }),
    8453: createPublicClient({ chain: base, transport: http(RPC[8453]) }),
    42161: createPublicClient({ chain: arbitrum, transport: http(RPC[42161]) }),
  } as Parameters<typeof createYoClient>[0]["publicClients"];
}

function buildWalletClient(pk: string, chainId: number) {
  const norm = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(norm as `0x${string}`);
  const chain = VIEM_CHAINS[chainId] ?? base;
  return createWalletClient({ account, chain, transport: http(RPC[chainId] ?? RPC[8453]) });
}

// ─── Main guardian cycle ─────────────────────────────────────────────────────
async function runCycle(pk: string) {
  if (["EVACUATING"].includes(state.status)) return;

  try {
    // ── SCAN ──
    state.status = "SCANNING";
    state.scansPerformed++;
    state.lastScan = Date.now();
    addLog({ timestamp: Date.now(), level: "INFO", message: "Guardian scanning vault health..." });

    const monitor = new VaultGuardianMonitor();
    const snapshot = await monitor.scan();
    state.lastSnapshot = snapshot;

    // Log vault status
    for (const v of snapshot.vaults) {
      const levelTag = v.riskLevel === "SAFE" ? "INFO"
        : v.riskLevel === "WARNING" ? "WARN"
        : "ERROR";
      addLog({
        timestamp: Date.now(),
        level: levelTag as LogEntry["level"],
        message: `  [${v.vaultId}] ${CHAIN_NAMES[v.chainId]}: ${v.riskLevel} (${v.riskScore}%) | APY ${v.apy7d ? `${parseFloat(v.apy7d).toFixed(2)}%` : "n/a"} | ${v.isPaused ? "PAUSED" : "active"}${v.sharePriceDelta !== null ? ` | shareΔ ${v.sharePriceDelta.toFixed(2)}%` : ""}`,
      });
    }

    addLog({
      timestamp: Date.now(),
      level: snapshot.overallRisk === "SAFE" ? "INFO" : snapshot.overallRisk === "WARNING" ? "WARN" : "ERROR",
      message: `Overall health: ${snapshot.overallRisk} (${snapshot.overallScore}%)`,
    });

    // ── Find which vaults we hold shares in ──
    const norm = pk.startsWith("0x") ? pk : `0x${pk}`;
    const agentAddr = privateKeyToAccount(norm as `0x${string}`).address;
    const publicClients = buildPublicClients();
    const client = createYoClient({ chainId: 8453, partnerId: 9999, publicClients });

    const heldVaults: string[] = [];
    for (const meta of VAULT_META) {
      const vaultCfg = VAULTS[meta.id];
      if (!vaultCfg) continue;
      try {
        const shares = await client.getShareBalance(vaultCfg.address, agentAddr);
        if (shares > 0n) heldVaults.push(meta.id);
      } catch { /* skip */ }
    }

    // ── EVALUATE — only if there's risk or we hold shares ──
    const riskyVaults = snapshot.vaults.filter((v) => v.riskScore >= 25);
    if (riskyVaults.length === 0 && heldVaults.length === 0) {
      state.lastSummary = "All vaults healthy — no positions held";
      state.status = "MONITORING";
      return;
    }

    state.status = "EVALUATING";
    addLog({ timestamp: Date.now(), level: "INFO", message: "Consulting guardian AI..." });

    const decision = await getGuardianDecision(snapshot.vaults, heldVaults);
    state.lastSummary = decision.summary;
    addLog({ timestamp: Date.now(), level: "INFO", message: `Guardian: ${decision.summary}` });

    // ── EXECUTE evacuations ──
    const simulation = state.mode === "SIMULATION";

    for (const d of decision.decisions) {
      if (d.action === "HOLD") {
        addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vaultId} (${CHAIN_NAMES[d.chainId]}): HOLD — ${d.reason}` });
        continue;
      }

      if (d.action === "WATCH") {
        addLog({ timestamp: Date.now(), level: "WARN", message: `  ${d.vaultId} (${CHAIN_NAMES[d.chainId]}): WATCH — ${d.reason}` });
        continue;
      }

      // EVACUATE — emergency redeem all shares
      if (d.action === "EVACUATE") {
        const meta = VAULT_META.find((m) => m.id === d.vaultId);
        const vaultCfg = VAULTS[d.vaultId as VaultId];
        if (!meta || !vaultCfg) continue;

        let shares = 0n;
        try {
          shares = await client.getShareBalance(vaultCfg.address, agentAddr);
        } catch { /* skip */ }

        if (shares === 0n) {
          addLog({ timestamp: Date.now(), level: "INFO", message: `  ${d.vaultId}: no shares to evacuate` });
          continue;
        }

        if (simulation) {
          // ── SIMULATION ──
          try {
            const expectedAssets = await client.quotePreviewRedeem(vaultCfg.address, shares);
            const assetsHuman = formatTokenAmount(expectedAssets, meta.decimals);
            addLog({
              timestamp: Date.now(),
              level: "SUCCESS",
              message: `  [SIM] EVACUATE ${d.vaultId} (${CHAIN_NAMES[d.chainId]}): Would redeem all → ~${assetsHuman} ${meta.symbol} | ${d.reason}`,
            });
            state.evacuationHistory.push({
              vaultId: d.vaultId, chainId: d.chainId,
              assetsRedeemed: assetsHuman, simulation: true,
              reason: d.reason, timestamp: Date.now(),
            });
            state.evacuationsPerformed++;
            if (guardianUserEoa) notifyEvacuation(guardianUserEoa, state.evacuationHistory[0]).catch(() => {});
          } catch (e) {
            addLog({ timestamp: Date.now(), level: "WARN", message: `  [SIM] ${d.vaultId}: preview redeem failed — ${String(e).slice(0, 80)}` });
          }
        } else {
          // ── LIVE ──
          try {
            state.status = "EVACUATING";
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] EVACUATING ${d.vaultId} on ${CHAIN_NAMES[d.chainId]} — ${d.reason}` });

            const txs = await client.prepareRedeemWithApproval({
              vault: vaultCfg.address,
              shares,
              owner: agentAddr,
              recipient: agentAddr,
            });

            const wc = buildWalletClient(pk, d.chainId);
            let lastHash: `0x${string}` | undefined;
            for (const tx of txs) {
              const hash = await wc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n, account: wc.account! });
              addLog({ timestamp: Date.now(), level: "INFO", message: `  tx: ${hash}` });
              await client.waitForTransaction(hash, d.chainId);
              lastHash = hash;
            }

            if (lastHash) {
              const receipt = await client.waitForRedeemReceipt(lastHash, d.chainId);
              const assetsHuman = formatTokenAmount(receipt.assetsOrRequestId as bigint, meta.decimals);
              addLog({
                timestamp: Date.now(),
                level: "SUCCESS",
                message: receipt.instant
                  ? `  [LIVE] EVACUATED ${d.vaultId}: ${assetsHuman} ${meta.symbol} recovered`
                  : `  [LIVE] ${d.vaultId}: queued redeem — request ID: ${receipt.assetsOrRequestId}`,
              });
              state.evacuationHistory.push({
                vaultId: d.vaultId, chainId: d.chainId,
                assetsRedeemed: receipt.instant ? assetsHuman : "queued",
                simulation: false, txHash: lastHash,
                reason: d.reason, timestamp: Date.now(),
              });
              state.evacuationsPerformed++;
            if (guardianUserEoa) notifyEvacuation(guardianUserEoa, state.evacuationHistory[0]).catch(() => {});
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            addLog({ timestamp: Date.now(), level: "ERROR", message: `  [LIVE] ${d.vaultId} evacuation failed: ${msg.slice(0, 120)}` });
            state.evacuationHistory.push({
              vaultId: d.vaultId, chainId: d.chainId,
              assetsRedeemed: "0", simulation: false,
              reason: d.reason, timestamp: Date.now(),
              error: msg.slice(0, 120),
            });
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

// ─── Public API ──────────────────────────────────────────────────────────────
export function startGuardianAgent(config: {
  privateKey: string;
  pollIntervalMs: number;
  mode: "SIMULATION" | "LIVE";
  userEoa?: string;
}) {
  if (["SCANNING", "EVACUATING", "EVALUATING"].includes(state.status)) {
    addLog({ timestamp: Date.now(), level: "WARN", message: "Guardian already running" });
    return;
  }

  guardianUserEoa = config.userEoa ?? null;
  state.mode = config.mode;
  state.status = "MONITORING";
  state.uptime = Date.now();

  const norm = config.privateKey.startsWith("0x") ? config.privateKey : `0x${config.privateKey}`;
  state.agentAddress = privateKeyToAccount(norm as `0x${string}`).address;

  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Guardian started [${config.mode}] — health checks every ${config.pollIntervalMs / 1000}s`,
  });
  addLog({
    timestamp: Date.now(),
    level: "INFO",
    message: `Monitoring: yoUSD, yoETH, yoBTC, yoEUR, yoGOLD, yoUSDT across ETH/Base/Arbitrum`,
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
