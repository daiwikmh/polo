"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ChevronDown, AlertTriangle, Shield, Pause, TrendingUp, DollarSign } from "lucide-react";
import type { VaultRiskAssessment } from "@/lib/guardian/monitor";

const VAULT_COLORS: Record<string, string> = {
  yoUSD: "#00FF8B",
  yoETH: "#D6FF34",
  yoBTC: "#FFAF4F",
  yoEUR: "#4E6FFF",
  yoGOLD: "#FFD700",
  yoUSDT: "#26A17B",
};

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

const RISK_COLORS: Record<string, string> = {
  SAFE: "#22c55e",
  WARNING: "#eab308",
  CRITICAL: "#f97316",
  EMERGENCY: "#ef4444",
};

function VaultDetail({ vault }: { vault: VaultRiskAssessment }) {
  const color = VAULT_COLORS[vault.vaultId] ?? "#D6FF34";
  const riskColor = RISK_COLORS[vault.riskLevel] ?? "#525252";
  const barPct = Math.min(vault.riskScore, 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Top row — vault identity + risk badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${color}14`, border: `1px solid ${color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color, letterSpacing: "-0.03em",
          }}>
            {vault.vaultId.replace("yo", "")}
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{vault.vaultId}</span>
            <span style={{ fontSize: 11, color: "#525252", marginLeft: 8 }}>
              {CHAIN_NAMES[vault.chainId] ?? vault.chainId}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {vault.isPaused && (
            <span style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 600, color: "#ef4444",
              padding: "3px 8px", borderRadius: 6,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
            }}>
              <Pause style={{ width: 10, height: 10 }} /> PAUSED
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, color: riskColor,
            padding: "3px 10px", borderRadius: 6,
            background: `${riskColor}14`, border: `1px solid ${riskColor}25`,
            letterSpacing: "0.05em",
          }}>
            {vault.riskLevel}
          </span>
        </div>
      </div>

      {/* Risk score bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em" }}>Risk Score</span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: riskColor }}>
            {vault.riskScore}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "#1a1a18", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            width: `${barPct}%`,
            background: riskColor,
            boxShadow: `0 0 8px ${riskColor}40`,
            transition: "width 0.6s ease-out",
          }} />
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <MetricBox
          icon={<TrendingUp style={{ width: 12, height: 12 }} />}
          label="7d APY"
          value={vault.apy7d !== null ? `${parseFloat(vault.apy7d).toFixed(2)}%` : "—"}
          color={vault.apy7d !== null ? color : "#525252"}
        />
        <MetricBox
          icon={<DollarSign style={{ width: 12, height: 12 }} />}
          label="Share Price"
          value={vault.sharePrice ?? "—"}
          color="#a0a0a0"
          sub={vault.sharePriceDelta !== null
            ? `${vault.sharePriceDelta >= 0 ? "+" : ""}${vault.sharePriceDelta.toFixed(4)}%`
            : undefined}
          subColor={vault.sharePriceDelta !== null
            ? (vault.sharePriceDelta < -0.01 ? "#ef4444" : "#22c55e")
            : undefined}
        />
        <MetricBox
          icon={<Shield style={{ width: 12, height: 12 }} />}
          label="TVL"
          value={vault.tvlFormatted ?? "—"}
          color="#a0a0a0"
        />
      </div>

      {/* Risk reasons */}
      {vault.reasons.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <p style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Risk Factors
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {vault.reasons.map((r, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 6,
                padding: "6px 8px", borderRadius: 6,
                background: "rgba(255,255,255,0.02)",
              }}>
                <AlertTriangle style={{ width: 10, height: 10, color: riskColor, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: "#a0a0a0", lineHeight: 1.4 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {vault.reasons.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 11, color: "#363634" }}>No risk factors detected</span>
        </div>
      )}
    </div>
  );
}

function MetricBox({ icon, label, value, color, sub, subColor }: {
  icon: React.ReactNode; label: string; value: string; color: string;
  sub?: string; subColor?: string;
}) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: "rgba(255,255,255,0.02)", border: "1px solid #1a1a18",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#525252", marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: subColor ?? "#525252", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

export default function TickChart({ vaults }: { vaults: VaultRiskAssessment[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);

  const selectedVault = selected ? vaults.find((v) => `${v.vaultId}:${v.chainId}` === selected) : null;

  const hasApy = vaults.some((v) => v.apy7d !== null);
  const data = vaults
    .map((v) => ({
      name: `${v.vaultId} · ${CHAIN_NAMES[v.chainId] ?? v.chainId}`,
      key: `${v.vaultId}:${v.chainId}`,
      value: v.apy7d !== null ? parseFloat(v.apy7d) : v.riskScore,
      apy: v.apy7d !== null ? parseFloat(v.apy7d) : null,
      riskScore: v.riskScore,
      riskLevel: v.riskLevel,
      vaultId: v.vaultId,
      isPaused: v.isPaused,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div style={{
      background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, padding: "18px 20px",
    }}>
      {/* Header with vault selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>Vault Health Monitor</h3>
          <p style={{ fontSize: 11, color: "#525252", margin: "2px 0 0" }}>
            {selectedVault
              ? `${selectedVault.vaultId} · ${CHAIN_NAMES[selectedVault.chainId]} analysis`
              : hasApy ? "APY + risk status across YO vaults" : "Risk score per vault"}
          </p>
        </div>

        {/* Vault picker */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropOpen(!dropOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: selected ? `${VAULT_COLORS[selectedVault?.vaultId ?? ""] ?? "#D6FF34"}10` : "#0a0a08",
              border: `1px solid ${selected ? `${VAULT_COLORS[selectedVault?.vaultId ?? ""] ?? "#D6FF34"}30` : "#1a1a18"}`,
              fontSize: 11, fontWeight: 600,
              color: selected ? (VAULT_COLORS[selectedVault?.vaultId ?? ""] ?? "#D6FF34") : "#525252",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {selectedVault ? selectedVault.vaultId : "All Vaults"}
            <ChevronDown style={{
              width: 12, height: 12,
              transform: dropOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }} />
          </button>

          {dropOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 4,
              background: "#0d0d0b", border: "1px solid #1a1a18", borderRadius: 10,
              padding: 4, zIndex: 20, minWidth: 160,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}>
              <button
                onClick={() => { setSelected(null); setDropOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6,
                  fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  background: !selected ? "rgba(255,255,255,0.04)" : "transparent",
                  color: !selected ? "#fff" : "#525252",
                  transition: "all 0.1s",
                }}
              >
                All Vaults
              </button>
              {vaults.map((v) => {
                const k = `${v.vaultId}:${v.chainId}`;
                const c = VAULT_COLORS[v.vaultId] ?? "#D6FF34";
                return (
                  <button
                    key={k}
                    onClick={() => { setSelected(k); setDropOpen(false); }}
                    style={{
                      width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6,
                      fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                      background: selected === k ? `${c}10` : "transparent",
                      color: selected === k ? c : "#a0a0a0",
                      display: "flex", alignItems: "center", gap: 8,
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />
                    {v.vaultId}
                    <span style={{ fontSize: 9, color: "#363634", marginLeft: "auto" }}>
                      {CHAIN_NAMES[v.chainId] ?? v.chainId}
                    </span>
                    {v.isPaused && <span style={{ fontSize: 8, color: "#ef4444", fontWeight: 700 }}>!</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={{ minHeight: 240 }}>
        {vaults.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, color: "#525252", fontSize: 12 }}>
            No vault data — start guardian to scan
          </div>
        ) : selectedVault ? (
          <VaultDetail vault={selectedVault} />
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232323" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#52525b" }}
                  axisLine={{ stroke: "#232323" }}
                  tickLine={false}
                  tickFormatter={(v) => hasApy ? `${v.toFixed(1)}%` : `${v.toFixed(0)}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  axisLine={false}
                  tickLine={false}
                  width={75}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181B", border: "1px solid #232323", borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: "#a1a1aa" }}
                  formatter={(value: number, _name: string, props: { payload?: { apy: number | null } }) =>
                    props.payload?.apy !== null
                      ? [`${value.toFixed(2)}%`, "7d APY"]
                      : [`${value.toFixed(0)}`, "Risk Score"]
                  }
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  cursor="pointer"
                  onClick={(d) => setSelected(d.key)}
                >
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isPaused ? "#ef4444" : (RISK_COLORS[entry.riskLevel] ?? "#22c55e")}
                      fillOpacity={0.7}
                      stroke={RISK_COLORS[entry.riskLevel] ?? "#22c55e"}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#525252" }}>
          {vaults.length} vault{vaults.length !== 1 ? "s" : ""} monitored
          {!hasApy && vaults.length > 0 && <span style={{ marginLeft: 6 }}>· APY loading</span>}
        </span>
        {vaults.some((d) => d.isPaused) && (
          <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Paused vaults detected</span>
        )}
      </div>
    </div>
  );
}
