"use client";

import { useUserPosition, useVaults } from "@yo-protocol/react";
import { formatUnits } from "viem";

const VAULT_COLORS: Record<string, string> = {
  yoUSD: "#00FF8B", yoETH: "#D6FF34", yoBTC: "#FFAF4F", yoEUR: "#4E6FFF",
};
const VAULT_DECIMALS: Record<string, number> = {
  yoUSD: 6, yoETH: 18, yoBTC: 8, yoEUR: 6,
};
const VAULT_UNDERLYING: Record<string, string> = {
  yoUSD: "USDC", yoETH: "WETH", yoBTC: "cbBTC", yoEUR: "EURC",
};

export default function YoPositionCard({
  vaultId,
}: {
  vaultId: "yoUSD" | "yoETH" | "yoBTC" | "yoEUR";
}) {
  const { position, isLoading: posLoading } = useUserPosition(vaultId);
  const { vaults } = useVaults();
  const vault = vaults.find((v) => v.id === vaultId && v.chain.id === 8453);

  const color = VAULT_COLORS[vaultId];
  const decimals = VAULT_DECIMALS[vaultId];
  const underlying = VAULT_UNDERLYING[vaultId];
  const apy7d = vault?.yield?.["7d"];
  const hasPosition = position && position.assets > 0n;

  return (
    <div style={{
      background: "#0a0a08",
      border: `1px solid ${hasPosition ? `${color}20` : "#1a1a18"}`,
      borderRadius: 12,
      padding: "14px",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: hasPosition ? color : "#363634",
            boxShadow: hasPosition ? `0 0 6px ${color}50` : "none",
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{vaultId}</span>
        </div>
        <span style={{ fontSize: 10, color: "#525252" }}>{underlying}</span>
      </div>

      {posLoading ? (
        <div style={{
          height: 20,
          background: "linear-gradient(90deg, #1a1a18 25%, #252523 50%, #1a1a18 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: 4,
        }} />
      ) : hasPosition ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)",
            color, letterSpacing: "-0.03em",
          }}>
            {Number(formatUnits(position.assets, decimals)).toFixed(4)}
            <span style={{ fontSize: 11, color: "#525252", marginLeft: 4 }}>{underlying}</span>
          </div>
          {apy7d != null && (
            <div style={{ fontSize: 10, color: "#525252" }}>
              7d APY:{" "}
              <span style={{ color, fontFamily: "var(--font-mono)" }}>
                {Number(apy7d).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#363634" }}>No position</div>
      )}

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
