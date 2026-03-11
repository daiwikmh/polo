"use client";

import { useState } from "react";
import { useVaults } from "@yo-protocol/react";
import type { VaultStatsItem } from "@yo-protocol/core";
import { YO_VAULTS, formatYield } from "@/lib/yo/vaults";
import YoDepositPanel from "./YoDepositPanel";

const VAULT_COLORS: Record<string, string> = {
  yoUSD: "#00FF8B",
  yoETH: "#D6FF34",
  yoBTC: "#FFAF4F",
  yoEUR: "#4E6FFF",
};

const YO_VAULT_IDS: string[] = YO_VAULTS.map((v) => v.id);

function Skeleton() {
  return (
    <span style={{
      display: "inline-block",
      width: 60,
      height: 12,
      borderRadius: 4,
      background: "linear-gradient(90deg, #1a1a18 25%, #252523 50%, #1a1a18 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

function VaultRow({
  vault,
  cfg,
  selected,
  onSelect,
  isLoading,
}: {
  vault: VaultStatsItem | undefined;
  cfg: (typeof YO_VAULTS)[number];
  selected: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const color = VAULT_COLORS[cfg.id] ?? "#D6FF34";
  const tvl = vault?.tvl?.formatted ?? (isLoading ? null : "—");
  const apy7d = vault?.yield?.["7d"];
  const apy1d = vault?.yield?.["1d"];
  const sharePrice = vault?.sharePrice?.formatted ?? (isLoading ? null : "—");

  return (
    <tr
      onClick={onSelect}
      style={{
        cursor: "pointer",
        background: selected ? `${color}08` : "transparent",
        borderBottom: "1px solid #111",
        transition: "background 0.15s",
      }}
    >
      {/* Vault */}
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${color}14`, border: `1px solid ${color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color, letterSpacing: "-0.03em",
          }}>
            {cfg.underlying[0]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{cfg.id}</div>
            <div style={{ fontSize: 11, color: "#525252", marginTop: 1 }}>{cfg.underlying}</div>
          </div>
        </div>
      </td>

      {/* TVL */}
      <td style={{ padding: "14px 16px" }}>
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "#a0a0a0" }}>
          {tvl == null ? <Skeleton /> : tvl}
        </span>
      </td>

      {/* 7d APY */}
      <td style={{ padding: "14px 16px" }}>
        <span style={{
          fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)",
          color: apy7d != null ? color : "#525252",
          textShadow: apy7d != null ? `0 0 12px ${color}40` : "none",
        }}>
          {apy7d == null ? <Skeleton /> : formatYield(apy7d)}
        </span>
      </td>

      {/* 1d APY */}
      <td style={{ padding: "14px 16px" }}>
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "#525252" }}>
          {apy1d == null && isLoading ? <Skeleton /> : formatYield(apy1d)}
        </span>
      </td>

      {/* Share Price */}
      <td style={{ padding: "14px 16px" }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#525252" }}>
          {sharePrice == null ? <Skeleton /> : sharePrice}
        </span>
      </td>

      {/* Action */}
      <td style={{ padding: "14px 16px", textAlign: "right" }}>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          style={{
            padding: "6px 14px", borderRadius: 6,
            border: `1px solid ${selected ? color : "#1e1e1c"}`,
            background: selected ? `${color}14` : "transparent",
            color: selected ? color : "#525252",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {selected ? "SELECTED" : "DEPOSIT"}
        </button>
      </td>
    </tr>
  );
}

export default function YoVaultScanner() {
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const { vaults, isLoading } = useVaults();

  // Filter to Base chain (8453) YO vaults
  const baseVaults = vaults.filter(
    (v) => v.chain.id === 8453 && YO_VAULT_IDS.includes(v.id)
  );

  const handleSelect = (id: string) => setSelectedVault((p) => (p === id ? null : id));

  return (
    <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid #1a1a18" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: "#D6FF34",
            boxShadow: "0 0 8px #D6FF3460", animation: "pulse 2s infinite",
          }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
            YO Vault Scanner
          </span>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 99,
            border: "1px solid #1e1e1c", color: "#525252", fontFamily: "var(--font-mono)",
          }}>
            Base · {YO_VAULTS.length} vaults
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "#525252", textTransform: "uppercase" }}>ERC-4626</span>
          <span style={{
            fontSize: 10, color: "#525252",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s", display: "inline-block",
          }}>▼</span>
        </div>
      </button>

      {open && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #111" }}>
                  {["Vault", "TVL", "7d APY", "1d APY", "Share Price", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px", fontSize: 10, fontWeight: 500,
                        color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em",
                        textAlign: h === "" ? "right" : "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {YO_VAULTS.map((cfg) => {
                  const vault = baseVaults.find((v) => v.id === cfg.id);
                  return (
                    <VaultRow
                      key={cfg.id}
                      vault={vault}
                      cfg={cfg}
                      selected={selectedVault === cfg.id}
                      onSelect={() => handleSelect(cfg.id)}
                      isLoading={isLoading}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedVault && (
            <div style={{ borderTop: "1px solid #1a1a18" }}>
              <YoDepositPanel
                vaultId={selectedVault as "yoUSD" | "yoETH" | "yoBTC" | "yoEUR"}
                onClose={() => setSelectedVault(null)}
              />
            </div>
          )}

          <div style={{ padding: "10px 20px", borderTop: "1px solid #111", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "#363634", letterSpacing: "0.1em" }}>
              POWERED BY YO PROTOCOL · ERC-4626 · BASE CHAIN · PARTNER ID 9999
            </span>
          </div>
        </>
      )}

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
