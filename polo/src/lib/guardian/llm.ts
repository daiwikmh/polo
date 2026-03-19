// Guardian LLM — decides whether to trigger emergency redeem based on vault risk
//
// Input: VaultRiskAssessment[] from monitor
// Output: per-vault decision (EVACUATE, WATCH, HOLD)

import type { VaultRiskAssessment } from "./monitor";

export interface GuardianDecision {
  vaultId: string;
  chainId: number;
  action: "EVACUATE" | "WATCH" | "HOLD";
  reason: string;
  confidence: number;
}

export interface GuardianLLMResponse {
  decisions: GuardianDecision[];
  summary: string;
}

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

export async function getGuardianDecision(
  risks: VaultRiskAssessment[],
  heldVaults: string[] // vault IDs we actually hold shares in
): Promise<GuardianLLMResponse> {
  const apiKey =
    process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

  if (!apiKey) return fallback(risks, heldVaults);

  try {
    const riskSummary = risks
      .filter((r) => heldVaults.includes(r.vaultId) || r.riskScore > 20)
      .map((r) =>
        `${r.vaultId} on ${CHAIN_NAMES[r.chainId]}: risk=${r.riskScore}% (${r.riskLevel}) | APY=${r.apy7d ?? "n/a"} | paused=${r.isPaused} | shareΔ=${r.sharePriceDelta !== null ? `${r.sharePriceDelta.toFixed(2)}%` : "n/a"} | reasons: ${r.reasons.join("; ")}`
      )
      .join("\n");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://polo.app",
        "X-Title": "polo guardian",
      },
      body: JSON.stringify({
        model:
          process.env.NEXT_PUBLIC_OPENROUTER_MODEL ||
          "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content:
              "You are an autonomous DeFi vault guardian protecting positions in YO Protocol ERC-4626 vaults. Analyze vault health data (share price changes, APY anomalies, paused state, TVL) and decide whether to EVACUATE (emergency redeem all shares), WATCH (elevated risk, monitor closely), or HOLD (safe). Only recommend EVACUATE for vaults we hold shares in and only when risk is severe (paused vault, sharp share price drop, or extreme anomalies). Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: `Vaults we hold shares in: ${heldVaults.join(", ") || "none"}

=== Vault Risk Data ===
${riskSummary || "No risk data"}

Rules:
- EVACUATE only if vault is paused AND we hold shares, or share price dropped >5%, or risk score >80%
- WATCH if risk score 25-80% and we hold shares
- HOLD for safe vaults

Respond with:
{"decisions":[{"vaultId":"yoUSD","chainId":8453,"action":"EVACUATE|WATCH|HOLD","reason":"one sentence","confidence":0-100},...], "summary":"one sentence"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(14000),
    });

    if (!res.ok) return fallback(risks, heldVaults);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    if (!content) return fallback(risks, heldVaults);

    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as GuardianLLMResponse;
    if (!Array.isArray(parsed.decisions)) return fallback(risks, heldVaults);
    return parsed;
  } catch {
    return fallback(risks, heldVaults);
  }
}

function fallback(
  risks: VaultRiskAssessment[],
  heldVaults: string[]
): GuardianLLMResponse {
  const decisions: GuardianDecision[] = [];

  for (const r of risks) {
    const weHold = heldVaults.includes(r.vaultId);

    if (r.riskScore >= 80 && weHold) {
      decisions.push({
        vaultId: r.vaultId,
        chainId: r.chainId,
        action: "EVACUATE",
        reason: `${r.riskLevel}: ${r.reasons[0]}`,
        confidence: 90,
      });
    } else if (r.riskScore >= 25 && weHold) {
      decisions.push({
        vaultId: r.vaultId,
        chainId: r.chainId,
        action: "WATCH",
        reason: `Elevated risk (${r.riskScore}%): ${r.reasons[0]}`,
        confidence: 75,
      });
    } else if (weHold) {
      decisions.push({
        vaultId: r.vaultId,
        chainId: r.chainId,
        action: "HOLD",
        reason: "Vault healthy — no action needed",
        confidence: 90,
      });
    }
  }

  const evacuations = decisions.filter((d) => d.action === "EVACUATE");
  const watches = decisions.filter((d) => d.action === "WATCH");
  const summary = evacuations.length > 0
    ? `EMERGENCY: ${evacuations.map((d) => d.vaultId).join(", ")} require immediate evacuation`
    : watches.length > 0
    ? `${watches.length} vault${watches.length > 1 ? "s" : ""} under elevated watch`
    : "All vaults healthy";

  return { decisions, summary };
}
