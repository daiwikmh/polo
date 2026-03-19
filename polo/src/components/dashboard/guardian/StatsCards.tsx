"use client";

import { Clock, Eye, Zap, TrendingUp, Shield, Wallet } from "lucide-react";
import type { GuardianAgentState } from "@/lib/guardian/agent";

export default function StatsCards({ state }: { state: GuardianAgentState }) {
  const uptime = state.uptime ? Math.max(0, Math.floor((Date.now() - state.uptime) / 1000)) : 0;
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = uptime % 60;
  const uptimeStr = uptime === 0
    ? "--:--:--"
    : `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  const overallRisk = state.lastSnapshot?.overallRisk ?? "N/A";
  const overallScore = state.lastSnapshot?.overallScore ?? 0;
  const vaultCount = state.lastSnapshot?.vaults.length ?? 0;
  const riskyCount = state.lastSnapshot?.vaults.filter((v) => v.riskScore >= 25).length ?? 0;

  const statusColor =
    state.status === "MONITORING" ? "#22c55e"
    : state.status === "SCANNING" || state.status === "EVALUATING" ? "#D6FF34"
    : state.status === "EVACUATING" ? "#ef4444"
    : state.status === "ERROR" ? "#ef4444"
    : "#525252";

  const statusGlow =
    state.status === "MONITORING" ? "0 0 20px rgba(34,197,94,0.1)"
    : state.status === "EVACUATING" ? "0 0 20px rgba(239,68,68,0.12)"
    : "none";

  const riskColor =
    overallRisk === "SAFE" ? "#22c55e"
    : overallRisk === "WARNING" ? "#eab308"
    : overallRisk === "CRITICAL" || overallRisk === "EMERGENCY" ? "#ef4444"
    : "#525252";

  const agentColor = state.agentAddress ? "#D6FF34" : "#525252";
  const vaultColor = riskyCount > 0 ? "#eab308" : "#D6FF34";
  const evacColor = state.evacuationsPerformed > 0 ? "#eab308" : "#525252";

  const cards = [
    {
      icon: Eye,
      label: "Status",
      value: state.status,
      sub: state.mode,
      color: statusColor,
      glow: statusGlow,
    },
    {
      icon: Wallet,
      label: "Agent",
      value: state.agentAddress
        ? `${state.agentAddress.slice(0, 6)}…${state.agentAddress.slice(-4)}`
        : "Not Set",
      sub: "Base Chain",
      color: agentColor,
      glow: "none",
    },
    {
      icon: Shield,
      label: "Health",
      value: overallRisk,
      sub: overallScore > 0 ? `${overallScore}% risk` : "awaiting scan",
      color: riskColor,
      glow: "none",
    },
    {
      icon: Clock,
      label: "Uptime",
      value: uptimeStr,
      sub: state.status === "IDLE" || state.status === "PAUSED" ? "not running" : "active",
      color: "#D6FF34",
      glow: "none",
    },
    {
      icon: TrendingUp,
      label: "Vaults",
      value: vaultCount > 0 ? `${vaultCount}` : "--",
      sub: riskyCount > 0 ? `${riskyCount} elevated risk` : "all safe",
      color: vaultColor,
      glow: "none",
    },
    {
      icon: Zap,
      label: "Evacuations",
      value: state.evacuationsPerformed.toString(),
      sub: state.evacuationsPerformed > 0 ? "triggered" : "none triggered",
      color: evacColor,
      glow: "none",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: "#0a0a08",
            border: "1px solid #1a1a18",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: card.glow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <card.icon style={{ width: 12, height: 12, color: "#525252", flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {card.label}
            </span>
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            color: card.color,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {card.value}
          </div>
          <div style={{ fontSize: 11, color: "#525252", marginTop: 6 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
