"use client";

import { useState } from "react";
import { useVaults } from "@yo-protocol/react";
import type { VaultStatsItem } from "@yo-protocol/core";
import {
  ALL_YO_VAULT_CONFIGS,
  ALL_YO_VAULT_IDS,
  YO_SUPPORTED_CHAIN_IDS,
  YO_VAULT_CHAIN_COMBOS,
  CHAIN_NAMES,
  CHAIN_COLORS,
  formatYield,
  formatTvl,
  formatTvlToken,
} from "@/lib/yo/vaults";
import YoDepositPanel from "./YoDepositPanel";

const VAULT_ORDER = ["yoUSD", "yoETH", "yoBTC", "yoEUR", "yoGOLD", "yoUSDT"];
const CHAIN_ORDER = [8453, 1, 42161];

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

function ChainBadge({ chainId }: { chainId: number }) {
  const name = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const color = CHAIN_COLORS[chainId] ?? "#525252";
  return (
    <span style={{
      fontSize: 9, padding: "2px 7px", borderRadius: 99,
      border: `1px solid ${color}40`,
      background: `${color}12`,
      color,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {name}
    </span>
  );
}

function VaultRow({
  vault,
  vaultId,
  chainId,
  selected,
  onSelect,
  isLoading,
}: {
  vault: VaultStatsItem | undefined;
  vaultId: string;
  chainId: number;
  selected: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const cfg = ALL_YO_VAULT_CONFIGS[vaultId];
  const color = cfg?.color ?? "#D6FF34";
  const canDeposit = chainId === 8453;

  const tvlRaw = vault?.tvl?.formatted;
  const underlying = cfg?.underlying ?? "";
  const isStable = ["USDC", "USDT", "EURC"].includes(underlying);
  const tvl = tvlRaw != null
    ? (isStable ? formatTvl(Number(tvlRaw)) : formatTvlToken(Number(tvlRaw), underlying))
    : (isLoading ? null : "—");
  const apy7d = vault?.yield?.["7d"];
  const apy1d = vault?.yield?.["1d"];
  const sharePrice = vault?.sharePrice?.formatted ?? (isLoading ? null : "—");

  return (
    <tr
      onClick={canDeposit ? onSelect : undefined}
      style={{
        cursor: canDeposit ? "pointer" : "default",
        background: selected ? `${color}08` : "transparent",
        borderBottom: "1px solid #111",
        transition: "background 0.15s",
        opacity: canDeposit ? 1 : 0.75,
      }}
    >
      {/* Vault */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `${color}14`, border: `1px solid ${color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color, letterSpacing: "-0.03em",
          }}>
            {cfg?.underlying[0] ?? "?"}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>{vaultId}</div>
            <div style={{ fontSize: 10, color: "#525252", marginTop: 1 }}>{cfg?.underlying ?? "—"}</div>
          </div>
        </div>
      </td>

      {/* Chain */}
      <td style={{ padding: "12px 16px" }}>
        <ChainBadge chainId={chainId} />
      </td>

      {/* TVL */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "#a0a0a0" }}>
          {tvl == null ? <Skeleton /> : tvl}
        </span>
      </td>

      {/* 7d APY */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{
          fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)",
          color: apy7d != null ? color : "#525252",
          textShadow: apy7d != null ? `0 0 12px ${color}40` : "none",
        }}>
          {apy7d == null ? <Skeleton /> : formatYield(apy7d)}
        </span>
      </td>

      {/* 1d APY */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#525252" }}>
          {apy1d == null && isLoading ? <Skeleton /> : formatYield(apy1d)}
        </span>
      </td>

      {/* Share Price */}
      <td style={{ padding: "12px 16px" }}>
        <span className="yo-text-white" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
          {sharePrice == null ? <Skeleton /> : sharePrice}
        </span>
      </td>

      {/* Action */}
      <td style={{ padding: "12px 16px", textAlign: "right" }}>
        {canDeposit ? (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            style={{
              padding: "5px 12px", borderRadius: 6,
              border: `1px solid ${selected ? color : "#1e1e1c"}`,
              background: selected ? `${color}14` : "transparent",
              color: selected ? color : "#525252",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {selected ? "SELECTED" : "DEPOSIT"}
          </button>
        ) : (
          <span style={{
            fontSize: 9, padding: "4px 8px", borderRadius: 99,
            border: "1px solid #1e1e1c", color: "#363634",
            fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          }}>
            BASE ONLY
          </span>
        )}
      </td>
    </tr>
  );
}

export default function YoVaultScanner() {
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const { vaults, isLoading } = useVaults();

  const allVaults = vaults.filter(
    (v) => (YO_SUPPORTED_CHAIN_IDS as readonly number[]).includes(v.chain.id) && ALL_YO_VAULT_IDS.includes(v.id)
  );

  const sortedVaults = [...allVaults].sort((a, b) => {
    const idxA = VAULT_ORDER.indexOf(a.id);
    const idxB = VAULT_ORDER.indexOf(b.id);
    if (idxA !== idxB) return idxA - idxB;
    return CHAIN_ORDER.indexOf(a.chain.id) - CHAIN_ORDER.indexOf(b.chain.id);
  });

  const handleSelect = (id: string) => setSelectedVault((p) => (p === id ? null : id));

  // Rows to render: live data when loaded, skeleton combos while loading
  const rows: Array<{ vaultId: string; chainId: number; vault?: VaultStatsItem }> = isLoading
    ? YO_VAULT_CHAIN_COMBOS.map((c) => ({ vaultId: c.id, chainId: c.chainId }))
    : sortedVaults.map((v) => ({ vaultId: v.id, chainId: v.chain.id, vault: v }));

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
            {isLoading ? `${YO_VAULT_CHAIN_COMBOS.length} vaults` : `${rows.length} vaults · 3 chains`}
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
                  {["Vault", "Chain", "TVL", "7d APY", "1d APY", "Share Price", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px", fontSize: 10, fontWeight: 500,
                        color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em",
                        textAlign: h === "" ? "right" : "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ vaultId, chainId, vault }) => (
                  <VaultRow
                    key={`${vaultId}:${chainId}`}
                    vault={vault}
                    vaultId={vaultId}
                    chainId={chainId}
                    selected={selectedVault === vaultId && chainId === 8453}
                    onSelect={() => handleSelect(vaultId)}
                    isLoading={isLoading}
                  />
                ))}
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
              POWERED BY YO PROTOCOL · ERC-4626 · ETHEREUM · BASE · ARBITRUM · DEPOSITS ON BASE ONLY
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
