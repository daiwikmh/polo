import type { VaultStatsItem } from "@yo-protocol/core";
import type { YoVaultPosition, YoTokenBalance } from "./yoAgent";

export interface YoDecision {
  vault: string;
  chainId: number;
  action: "DEPOSIT" | "REDEEM_ALL" | "HOLD" | "SKIP";
  amountHuman?: string; // for DEPOSIT
  reason: string;
  confidence: number;
}

export interface YoLLMResponse {
  decisions: YoDecision[];
  summary: string;
}

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

export async function getYoDecision(
  positions: YoVaultPosition[],
  tokenBalances: YoTokenBalance[],
  allVaults: VaultStatsItem[]
): Promise<YoLLMResponse> {
  const apiKey =
    process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

  if (!apiKey) return fallback(positions, tokenBalances, allVaults);

  try {
    const vaultSummary = buildVaultSummary(positions, tokenBalances, allVaults);
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
              "You are an autonomous DeFi yield optimizer managing assets across Yo Protocol ERC-4626 vaults (yoUSD, yoETH, yoBTC, yoEUR, yoGOLD, yoUSDT). Analyze vault APYs, current positions, and idle balances. Decide whether to DEPOSIT idle tokens, HOLD current positions, REDEEM_ALL underperforming positions, or SKIP (no action). Prioritize vaults with 7d APY > 2%. Only deposit amounts the agent actually holds. Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: `${vaultSummary}

Minimum APY to justify holding: 1.5%
Minimum APY improvement to trigger REDEEM + switch: 2.5%

Respond with:
{"decisions":[{"vault":"yoUSD","chainId":8453,"action":"DEPOSIT|REDEEM_ALL|HOLD|SKIP","amountHuman":"amount as string, only for DEPOSIT","reason":"one sentence","confidence":0-100},...], "summary":"one sentence overall strategy"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(14000),
    });

    if (!res.ok) return fallback(positions, tokenBalances, allVaults);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    if (!content) return fallback(positions, tokenBalances, allVaults);

    // Strip markdown code fences if present
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as YoLLMResponse;
    if (!Array.isArray(parsed.decisions)) return fallback(positions, tokenBalances, allVaults);

    return parsed;
  } catch {
    return fallback(positions, tokenBalances, allVaults);
  }
}

function buildVaultSummary(
  positions: YoVaultPosition[],
  tokenBalances: YoTokenBalance[],
  allVaults: VaultStatsItem[]
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

  return lines.join("\n");
}

// ─── Fallback (no API key or LLM error) ──────────────────────────────────────
function fallback(
  positions: YoVaultPosition[],
  tokenBalances: YoTokenBalance[],
  allVaults: VaultStatsItem[]
): YoLLMResponse {
  const decisions: YoDecision[] = [];

  // For each idle token balance, DEPOSIT into corresponding vault if APY > 1.5%
  for (const bal of tokenBalances) {
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

  const deposits = decisions.filter((d) => d.action === "DEPOSIT");
  const summary = deposits.length > 0
    ? `Deploying idle assets into ${deposits.map((d) => d.vault).join(", ")}`
    : decisions.some((d) => d.action === "HOLD")
    ? "All positions at acceptable yield — holding"
    : "No actionable positions found";

  return { decisions, summary };
}
