"use client";

import { Bot, Lock, Shield, Wifi, WifiOff } from "lucide-react";
import type { GuardianAgentState } from "@/lib/guardian/agent";

export default function AgentPanel({ state }: { state: GuardianAgentState }) {
  const isLive = !["IDLE", "PAUSED", "ERROR"].includes(state.status);

  const overallRisk = state.lastSnapshot?.overallRisk ?? "N/A";
  const overallScore = state.lastSnapshot?.overallScore ?? 0;
  const riskColor =
    overallScore < 15 ? "var(--success)" : overallScore < 40 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="agent-panel">
      {/* Header */}
      <div className="agent-header">
        <div className="agent-icon"><Shield /></div>
        <div className="flex-1 min-w-0">
          <p className="agent-name">Guardian</p>
          <p className="agent-role">YO Vault Protector</p>
        </div>
        <div className="agent-status">
          {isLive
            ? <Wifi className="w-3 h-3" style={{ color: "var(--success)" }} />
            : <WifiOff className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          }
          <span style={{ color: isLive ? "var(--success)" : "var(--text-muted)" }}>
            {isLive ? "Live" : "Off"}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="metric-card">
          <p className="metric-label">Scans</p>
          <p className="metric-value">{state.scansPerformed}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Evacuations</p>
          <p className="metric-value">{state.evacuationsPerformed}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Risk</p>
          <p className="metric-value" style={{ color: overallScore > 0 ? riskColor : undefined }}>
            {overallScore > 0 ? `${overallScore}%` : "--"}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Last Scan</p>
          <p className="metric-value">
            {state.lastScan
              ? new Date(state.lastScan).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
              : "--"}
          </p>
        </div>
      </div>

      {/* Connections */}
      <div className="space-y-1.5">
        <p className="conn-label uppercase tracking-wider">Connections</p>
        <ConnRow label="RPC" value={isLive ? "Connected" : "Idle"} ok={isLive} />
        <ConnRow label="YO Protocol" value="v1.0" ok />
        <ConnRow label="LI.FI" value="v3.x" ok icon />
      </div>

      {/* Mode */}
      <div className="shield-box">
        <div className="shield-title"><Lock /> Mode: {state.mode}</div>
        <p className="shield-text">
          {state.mode === "LIVE"
            ? "Live mode — emergency redeems enabled."
            : "Simulation — monitoring only, no withdrawals."}
        </p>
      </div>
    </div>
  );
}

function ConnRow({ label, value, ok, icon }: { label: string; value: string; ok?: boolean; icon?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="conn-label">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon && <Lock className="w-2.5 h-2.5" style={{ color: "var(--accent)" }} />}
        <span className={`conn-value ${ok ? "ok" : "off"}`}>{value}</span>
      </div>
    </div>
  );
}
