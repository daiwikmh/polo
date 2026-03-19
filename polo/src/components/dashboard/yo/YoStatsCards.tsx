"use client";

import { useVaults, useMerklRewards, useClaimMerklRewards } from "@yo-protocol/react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { formatTvl, formatYield } from "@/lib/yo/vaults";

const YO_BASE_IDS = ["yoUSD", "yoETH", "yoBTC", "yoEUR"];
const VAULT_COLORS: Record<string, string> = {
  yoUSD: "#00FF8B", yoETH: "#D6FF34", yoBTC: "#FFAF4F", yoEUR: "#4E6FFF",
};

function Shimmer() {
  return (
    <span style={{
      display: "inline-block", width: 80, height: 20, borderRadius: 4,
      background: "linear-gradient(90deg, #1a1a18 25%, #252523 50%, #1a1a18 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
    }} />
  );
}

function parseTvlStr(s: string): number {
  const clean = (s ?? "").replace(/[$,\s]/g, "");
  if (clean.endsWith("T")) return parseFloat(clean) * 1e12;
  if (clean.endsWith("B")) return parseFloat(clean) * 1e9;
  if (clean.endsWith("M")) return parseFloat(clean) * 1e6;
  if (clean.endsWith("K")) return parseFloat(clean) * 1e3;
  return parseFloat(clean) || 0;
}

function TvlAndApyStats() {
  const { vaults, isLoading } = useVaults();
  const baseVaults = vaults.filter((v) => v.chain.id === 8453 && YO_BASE_IDS.includes(v.id));
  const totalTvl = baseVaults.reduce((acc, v) => acc + parseTvlStr(v.tvl?.formatted ?? ""), 0);
  const best = baseVaults.reduce<{ id: string; apy: number } | null>((b, v) => {
    const apy = Number(v.yield?.["7d"] ?? 0);
    return !b || apy > b.apy ? { id: v.id, apy } : b;
  }, null);

  return (
    <>
      {/* TVL */}
      <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, padding: "16px 18px", boxShadow: "0 0 20px rgba(214,255,52,0.06)" }}>
        <div style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Total TVL — Base</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#D6FF34", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {isLoading ? <Shimmer /> : formatTvl(totalTvl)}
        </div>
        <div style={{ fontSize: 11, color: "#525252", marginTop: 6 }}>4 active vaults</div>
      </div>

      {/* Best APY */}
      <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Best 7d APY</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: best ? (VAULT_COLORS[best.id] ?? "#D6FF34") : "#525252", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {isLoading ? <Shimmer /> : formatYield(best?.apy)}
        </div>
        <div style={{ fontSize: 11, color: "#525252", marginTop: 6 }}>{best ? `${best.id} · Base` : "—"}</div>
      </div>
    </>
  );
}

function MerklClaimCard() {
  const { address } = useAccount();
  const { rewards, totalClaimable, hasClaimable, isLoading } = useMerklRewards(address);
  const { claim, isLoading: isClaiming, isSuccess } = useClaimMerklRewards();

  const formatted = hasClaimable ? Number(formatUnits(totalClaimable, 18)).toFixed(6) : "0.000000";

  const handleClaim = async () => {
    if (!address || !rewards || !hasClaimable) return;
    try { await claim(rewards); } catch { /* ignore */ }
  };

  return (
    <div style={{
      background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, padding: "16px 18px",
      boxShadow: hasClaimable ? "0 0 20px rgba(214,255,52,0.08)" : "none",
      gridColumn: "span 2",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    }}>
      {/* Left: label + amount */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: hasClaimable ? "#D6FF34" : "#363634",
            boxShadow: hasClaimable ? "0 0 6px #D6FF3460" : "none",
          }} />
          <span style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Merkl Rewards — Base
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: hasClaimable ? "#D6FF34" : "#363634", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {isLoading ? <Shimmer /> : formatted}
        </div>
        <div style={{ fontSize: 11, color: "#525252", marginTop: 6 }}>
          {!address ? "Connect wallet to view" : hasClaimable ? "Claimable on Base" : "No rewards yet"}
        </div>
      </div>

      {/* Right: claim button */}
      <button
        onClick={handleClaim}
        disabled={isClaiming || !hasClaimable}
        style={{
          padding: "10px 20px", borderRadius: 10, fontSize: 11, fontWeight: 700,
          border: `1px solid ${hasClaimable ? "rgba(214,255,52,0.3)" : "#1a1a18"}`,
          background: hasClaimable ? "rgba(214,255,52,0.08)" : "transparent",
          color: hasClaimable ? "#D6FF34" : "#363634",
          cursor: isClaiming || !hasClaimable ? "not-allowed" : "pointer",
          letterSpacing: "0.05em", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
        }}
      >
        {isClaiming && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid #D6FF34", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        )}
        {isSuccess ? "Claimed ✓" : isClaiming ? "Claiming…" : "Claim Rewards"}
      </button>
    </div>
  );
}

export default function YoStatsCards() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <TvlAndApyStats />
        <MerklClaimCard />
      </div>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
