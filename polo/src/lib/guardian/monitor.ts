// YO Vault Guardian Monitor
//
// Monitors YO Protocol vault health: share price stability, TVL changes,
// APY anomalies, and vault paused state. Produces per-vault risk assessments
// that feed into the guardian LLM for evacuation decisions.

import { createYoClient, VAULTS, formatTokenAmount } from "@yo-protocol/core";
import type { VaultId, VaultStatsItem } from "@yo-protocol/core";
import { createPublicClient, http } from "viem";
import { base, mainnet, arbitrum } from "viem/chains";

// ─── Types ───────────────────────────────────────────────────────────────────
export type VaultRiskLevel = "SAFE" | "WARNING" | "CRITICAL" | "EMERGENCY";

export interface VaultRiskAssessment {
  vaultId: string;
  chainId: number;
  riskLevel: VaultRiskLevel;
  riskScore: number; // 0-100
  reasons: string[];
  sharePrice: string | null;
  sharePriceDelta: number | null; // % change from last check
  tvlFormatted: string | null;
  apy7d: string | null;
  isPaused: boolean;
  timestamp: number;
}

export interface GuardianSnapshot {
  vaults: VaultRiskAssessment[];
  overallRisk: VaultRiskLevel;
  overallScore: number;
  timestamp: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────
const RPC: Record<number, string> = {
  8453: process.env.BASE_RPC_URL ?? "https://base-mainnet.g.alchemy.com/v2/t7Oxw5b_OpDL6yQVWN70ZjxO6hTCaZeW",
  1: process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com",
  42161: process.env.ARB_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/v2/t7Oxw5b_OpDL6yQVWN70ZjxO6hTCaZeW",
};

const VIEM_CHAINS = { 8453: base, 1: mainnet, 42161: arbitrum } as const;

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

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

// ─── Share price history (in-memory ring buffer per vault) ───────────────────
const sharePriceHistory: Record<string, { price: number; ts: number }[]> = {};
const MAX_HISTORY = 60; // keep ~60 data points

function recordSharePrice(key: string, price: number) {
  if (!sharePriceHistory[key]) sharePriceHistory[key] = [];
  sharePriceHistory[key].push({ price, ts: Date.now() });
  if (sharePriceHistory[key].length > MAX_HISTORY) {
    sharePriceHistory[key] = sharePriceHistory[key].slice(-MAX_HISTORY);
  }
}

function getSharePriceDelta(key: string, currentPrice: number): number | null {
  const hist = sharePriceHistory[key];
  if (!hist || hist.length < 2) return null;
  const prev = hist[hist.length - 2].price;
  if (prev === 0) return null;
  return ((currentPrice - prev) / prev) * 100;
}

// ─── Monitor class ───────────────────────────────────────────────────────────
export class VaultGuardianMonitor {
  private buildPublicClients() {
    return {
      1: createPublicClient({ chain: mainnet, transport: http(RPC[1]) }),
      8453: createPublicClient({ chain: base, transport: http(RPC[8453]) }),
      42161: createPublicClient({ chain: arbitrum, transport: http(RPC[42161]) }),
    } as Parameters<typeof createYoClient>[0]["publicClients"];
  }

  /**
   * Scan all vaults and produce a full guardian snapshot with risk assessments.
   */
  async scan(): Promise<GuardianSnapshot> {
    const publicClients = this.buildPublicClients();
    const client = createYoClient({ chainId: 8453, partnerId: 9999, publicClients });

    // Fetch vault stats
    let allVaults: VaultStatsItem[];
    try {
      allVaults = await client.getVaults({ secondary: true });
    } catch {
      allVaults = await client.getVaults();
    }

    const assessments: VaultRiskAssessment[] = [];

    for (const meta of VAULT_META) {
      const vaultCfg = VAULTS[meta.id];
      if (!vaultCfg) continue;
      const vaultAddr = vaultCfg.address;

      for (const chainId of meta.chains) {
        const key = `${meta.id}-${chainId}`;
        const reasons: string[] = [];
        let riskScore = 0;

        // Vault stats from API
        const vaultStat = allVaults.find(
          (v) => v.id?.toLowerCase() === meta.id.toLowerCase() && v.chain?.id === chainId
        );

        const apy7d = vaultStat?.yield?.["7d"] ?? null;
        const tvlFormatted = vaultStat?.tvl?.formatted ?? null;

        // ── Share price check ──
        let sharePrice: string | null = null;
        let sharePriceDelta: number | null = null;
        try {
          const sp = vaultStat?.sharePrice?.formatted;
          if (sp) {
            sharePrice = sp;
            const spNum = parseFloat(sp);
            recordSharePrice(key, spNum);
            sharePriceDelta = getSharePriceDelta(key, spNum);

            // Share price deviation from 1.0 (for stablecoins-backed vaults)
            // For non-stablecoins, check for sudden drops
            if (sharePriceDelta !== null && sharePriceDelta < -1.0) {
              riskScore += 30;
              reasons.push(`Share price dropped ${sharePriceDelta.toFixed(2)}% since last check`);
            }
            if (sharePriceDelta !== null && sharePriceDelta < -5.0) {
              riskScore += 40; // additional penalty for severe drop
              reasons.push(`SEVERE share price drop: ${sharePriceDelta.toFixed(2)}%`);
            }
          }
        } catch { /* skip */ }

        // ── Vault paused check ──
        let isPaused = false;
        try {
          isPaused = await client.isPaused(vaultAddr);
          if (isPaused) {
            riskScore += 50;
            reasons.push("Vault is PAUSED — deposits/redeems disabled");
          }
        } catch {
          // Can't check pause state — minor risk
          riskScore += 5;
          reasons.push("Could not verify vault pause state");
        }

        // ── APY anomaly check ──
        if (apy7d !== null) {
          const apyNum = parseFloat(apy7d);
          if (apyNum < 0) {
            riskScore += 25;
            reasons.push(`Negative APY: ${apyNum.toFixed(2)}%`);
          } else if (apyNum > 100) {
            riskScore += 15;
            reasons.push(`Unusually high APY: ${apyNum.toFixed(2)}% — possible anomaly`);
          }
        } else {
          riskScore += 5;
          reasons.push("No APY data available");
        }

        // ── TVL check ──
        if (tvlFormatted) {
          const tvlNum = parseFloat(tvlFormatted);
          if (tvlNum < 1000) {
            riskScore += 15;
            reasons.push(`Very low TVL: ${tvlFormatted} ${meta.symbol}`);
          }
        }

        // Clamp
        riskScore = Math.min(100, Math.max(0, riskScore));
        if (reasons.length === 0) reasons.push("All checks passed");

        const riskLevel: VaultRiskLevel =
          riskScore >= 80 ? "EMERGENCY"
          : riskScore >= 50 ? "CRITICAL"
          : riskScore >= 25 ? "WARNING"
          : "SAFE";

        assessments.push({
          vaultId: meta.id,
          chainId,
          riskLevel,
          riskScore,
          reasons,
          sharePrice,
          sharePriceDelta,
          tvlFormatted,
          apy7d,
          isPaused,
          timestamp: Date.now(),
        });
      }
    }

    // Overall risk = worst vault
    const worstScore = Math.max(0, ...assessments.map((a) => a.riskScore));
    const overallRisk: VaultRiskLevel =
      worstScore >= 80 ? "EMERGENCY"
      : worstScore >= 50 ? "CRITICAL"
      : worstScore >= 25 ? "WARNING"
      : "SAFE";

    return {
      vaults: assessments,
      overallRisk,
      overallScore: worstScore,
      timestamp: Date.now(),
    };
  }
}
