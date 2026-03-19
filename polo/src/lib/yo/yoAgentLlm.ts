import type { VaultStatsItem } from "@yo-protocol/core";
import type { YoVaultPosition, YoTokenBalance } from "./yoAgent";

export interface YoDecision {
  vault: string;
  chainId: number;
  action: "DEPOSIT" | "REDEEM_ALL" | "HOLD" | "SKIP" | "OPPORTUNITY" | "BRIDGE_AND_DEPOSIT";
  amountHuman?: string; // for DEPOSIT or BRIDGE_AND_DEPOSIT
  sourceChainId?: number; // for BRIDGE_AND_DEPOSIT — where tokens currently are
  reason: string;
  confidence: number;
}

// Bridge quote info passed into LLM decision
export interface BridgeQuoteContext {
  fromChainId: number;
  toChainId: number;
  vaultId: string;
  symbol: string;
  amountHuman: string;
  bridgeName: string;
  estimatedTime: number;
  bridgeCost: number;
}

export interface YoLLMResponse {
  decisions: YoDecision[];
  summary: string;
}

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

export async function getYoDecision(
  positions: YoVaultPosition[],
  tokenBalances: YoTokenBalance[],
  allVaults: VaultStatsItem[],
  bridgeQuotes?: BridgeQuoteContext[]
): Promise<YoLLMResponse> {
  const apiKey =
    process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

  if (!apiKey) return fallback(positions, tokenBalances, allVaults, bridgeQuotes);

  try {
    const vaultSummary = buildVaultSummary(positions, tokenBalances, allVaults, bridgeQuotes);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://polo.app",
        "X-Title": "polo yo agent",
      },
      body: JSON.stringify({
        model:
          process.env.NEXT_PUBLIC_OPENROUTER_MODEL ||
          "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content:
              "You are an autonomous DeFi yield optimizer managing assets across Yo Protocol ERC-4626 vaults (yoUSD, yoETH, yoBTC, yoEUR, yoGOLD, yoUSDT) on multiple chains (Ethereum, Base, Arbitrum). Analyze vault APYs, current positions, and idle balances. Decide whether to DEPOSIT idle tokens, HOLD current positions, REDEEM_ALL underperforming positions, SKIP (no action), OPPORTUNITY (vault has attractive yield but wallet has no balance — flag for funding), or BRIDGE_AND_DEPOSIT (idle tokens on a different chain than the best vault — bridge then deposit). For BRIDGE_AND_DEPOSIT include sourceChainId (where tokens are now) and chainId (target vault chain). Only recommend bridging when the yield advantage justifies the bridge cost. Prioritize vaults with 7d APY > 2%. Only use DEPOSIT for amounts the agent actually holds on the same chain. Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: `${vaultSummary}

Minimum APY to justify holding: 1.5%
Minimum APY improvement to trigger REDEEM + switch: 2.5%

Respond with:
{"decisions":[{"vault":"yoUSD","chainId":8453,"action":"DEPOSIT|REDEEM_ALL|HOLD|SKIP|OPPORTUNITY|BRIDGE_AND_DEPOSIT","amountHuman":"amount as string, for DEPOSIT or BRIDGE_AND_DEPOSIT","sourceChainId":1,"reason":"one sentence","confidence":0-100},...], "summary":"one sentence overall strategy"}
Note: sourceChainId is only needed for BRIDGE_AND_DEPOSIT (where tokens currently are). chainId is always the target vault chain.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(14000),
    });

    if (!res.ok) return fallback(positions, tokenBalances, allVaults, bridgeQuotes);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    if (!content) return fallback(positions, tokenBalances, allVaults, bridgeQuotes);

    // Strip markdown code fences if present
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as YoLLMResponse;
    if (!Array.isArray(parsed.decisions)) return fallback(positions, tokenBalances, allVaults, bridgeQuotes);

    return parsed;
  } catch {
    return fallback(positions, tokenBalances, allVaults, bridgeQuotes);
  }
}

function buildVaultSummary(
  positions: YoVaultPosition[],
  tokenBalances: YoTokenBalance[],
  allVaults: VaultStatsItem[],
  bridgeQuotes?: BridgeQuoteContext[]
): string {
  const lines: string[] = [];

  lines.push("=== YO Protocol Vault Data ===");
  const relevant = allVaults.filter((v) => ["yoUSD","yoETH","yoBTC","yoEUR","yoGOLD","yoUSDT"].includes(v.id));
  for (const v of relevant) {
    const apy7d = v.yield?.["7d"] ? `${parseFloat(v.yield["7d"]).toFixed(2)}%` : "n/a";
    lines.push(`${v.id} (${v.chain?.name ?? "?"}): 7d APY=${apy7d} | TVL=${v.tvl?.formatted ?? "—"}`);
  }

  lines.push("\n=== Agent Positions (current shares held) ===");
  if (positions.length === 0) {
    lines.push("No current positions");
  } else {
    for (const p of positions) {
      if (p.shares !== "0") {
        lines.push(`${p.vaultId} on ${CHAIN_NAMES[p.chainId]}: ${p.assetsHuman} (7d APY: ${p.apy7d ? `${parseFloat(p.apy7d).toFixed(2)}%` : "n/a"})`);
      }
    }
  }

  lines.push("\n=== Idle Token Balances (available to deposit) ===");
  if (tokenBalances.length === 0) {
    lines.push("No idle balances");
  } else {
    for (const b of tokenBalances) {
      lines.push(`${b.symbol} on ${CHAIN_NAMES[b.chainId]}: ${b.balanceHuman} (feeds into ${b.vaultId})`);
    }
  }

  if (bridgeQuotes && bridgeQuotes.length > 0) {
    lines.push("\n=== Cross-Chain Bridge Opportunities ===");
    for (const bq of bridgeQuotes) {
      lines.push(
        `${bq.symbol} on ${CHAIN_NAMES[bq.fromChainId]} → ${bq.vaultId} on ${CHAIN_NAMES[bq.toChainId]}: ${bq.amountHuman} ${bq.symbol} available | Bridge via ${bq.bridgeName} | cost: ${bq.bridgeCost.toFixed(4)} ${bq.symbol} | est. time: ${bq.estimatedTime}s`
      );
    }
  }

  return lines.join("\n");
}

// ─── Fallback (no API key or LLM error) ──────────────────────────────────────
function fallback(
  positions: YoVaultPosition[],
  tokenBalances: YoTokenBalance[],
  allVaults: VaultStatsItem[],
  bridgeQuotes?: BridgeQuoteContext[]
): YoLLMResponse {
  const decisions: YoDecision[] = [];

  // For each idle token balance, DEPOSIT into corresponding vault if APY > 1.5%
  for (const bal of tokenBalances) {
    // Check same-chain vault APY
    const vaultStat = allVaults.find(
      (v) => v.id?.toLowerCase() === bal.vaultId.toLowerCase() && v.chain?.id === bal.chainId
    );
    const apy = vaultStat?.yield?.["7d"] ? parseFloat(vaultStat.yield["7d"]) : 0;

    if (apy > 1.5) {
      decisions.push({
        vault: bal.vaultId,
        chainId: bal.chainId,
        action: "DEPOSIT",
        amountHuman: bal.balanceHuman,
        reason: `Idle ${bal.symbol} earning 0% — vault offers ${apy.toFixed(2)}% APY`,
        confidence: 80,
      });
    } else {
      // Check if a cross-chain bridge quote exists for this token with better APY
      const bridgeQuote = bridgeQuotes?.find(
        (bq) => bq.vaultId === bal.vaultId && bq.fromChainId === bal.chainId
      );
      if (bridgeQuote) {
        // Find target chain vault APY
        const targetVault = allVaults.find(
          (v) => v.id?.toLowerCase() === bal.vaultId.toLowerCase() && v.chain?.id === bridgeQuote.toChainId
        );
        const targetApy = targetVault?.yield?.["7d"] ? parseFloat(targetVault.yield["7d"]) : 0;
        if (targetApy > 1.5) {
          decisions.push({
            vault: bal.vaultId,
            chainId: bridgeQuote.toChainId,
            sourceChainId: bal.chainId,
            action: "BRIDGE_AND_DEPOSIT",
            amountHuman: bal.balanceHuman,
            reason: `Idle ${bal.symbol} on ${CHAIN_NAMES[bal.chainId]} — bridge to ${CHAIN_NAMES[bridgeQuote.toChainId]} for ${targetApy.toFixed(2)}% APY (bridge cost: ${bridgeQuote.bridgeCost.toFixed(4)} ${bal.symbol})`,
            confidence: 75,
          });
          continue;
        }
      }

      decisions.push({
        vault: bal.vaultId,
        chainId: bal.chainId,
        action: "SKIP",
        reason: apy > 0 ? `APY ${apy.toFixed(2)}% too low to deploy` : "No vault APY data",
        confidence: 70,
      });
    }
  }

  // For current positions with no better alternative, HOLD
  for (const pos of positions) {
    if (pos.shares === "0") continue;
    const alreadyDecided = decisions.some((d) => d.vault === pos.vaultId && d.chainId === pos.chainId);
    if (alreadyDecided) continue;
    const apy = pos.apy7d ? parseFloat(pos.apy7d) : 0;
    if (apy > 1.5) {
      decisions.push({ vault: pos.vaultId, chainId: pos.chainId, action: "HOLD", reason: `${apy.toFixed(2)}% APY — holding`, confidence: 80 });
    } else {
      decisions.push({ vault: pos.vaultId, chainId: pos.chainId, action: "REDEEM_ALL", reason: `APY ${apy.toFixed(2)}% below threshold`, confidence: 70 });
    }
  }

  // No funds and no positions — surface best yield opportunities
  if (decisions.length === 0) {
    const seen = new Set<string>();
    const sorted = [...allVaults].sort((a, b) => {
      // Base-chain entries first so we prefer the execution chain
      if (a.chain?.id === 8453 && b.chain?.id !== 8453) return -1;
      if (b.chain?.id === 8453 && a.chain?.id !== 8453) return 1;
      return 0;
    });
    for (const v of sorted) {
      if (!["yoUSD", "yoETH", "yoBTC", "yoEUR", "yoGOLD", "yoUSDT"].includes(v.id)) continue;
      if (seen.has(v.id)) continue;
      const apy = v.yield?.["7d"] ? parseFloat(v.yield["7d"]) : 0;
      if (apy > 1.5) {
        seen.add(v.id);
        decisions.push({
          vault: v.id,
          chainId: v.chain?.id ?? 8453,
          action: "OPPORTUNITY",
          reason: `${apy.toFixed(2)}% 7d APY — deposit ${v.id.replace("yo", "")} to activate`,
          confidence: 90,
        });
      }
    }
  }

  const deposits = decisions.filter((d) => d.action === "DEPOSIT");
  const opportunities = decisions.filter((d) => d.action === "OPPORTUNITY");
  const summary = deposits.length > 0
    ? `Deploying idle assets into ${deposits.map((d) => d.vault).join(", ")}`
    : decisions.some((d) => d.action === "HOLD")
    ? "All positions at acceptable yield — holding"
    : opportunities.length > 0
    ? `${opportunities.length} yield opportunit${opportunities.length === 1 ? "y" : "ies"} identified — fund wallet to deploy`
    : "No actionable positions found";

  return { decisions, summary };
}
