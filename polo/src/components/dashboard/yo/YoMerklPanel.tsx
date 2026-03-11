"use client";

import type { YoAgentState } from "@/lib/yo/yoAgent";

const STATUS_COLOR: Record<string, string> = {
  IDLE:       "#363634",
  MONITORING: "#D6FF34",
  SCANNING:   "#4E6FFF",
  DECIDING:   "#FFAF4F",
  DEPOSITING: "#00FF8B",
  REDEEMING:  "#FF5555",
  PAUSED:     "#525252",
  ERROR:      "#FF5555",
};

export default function YoMerklPanel({
  state,
  onAction,
  isStarting,
  startError,
  onStart,
}: {
  state: YoAgentState;
  onAction: (action: string, data?: Record<string, unknown>) => Promise<string | null>;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void;
}) {
  const isActive = !["IDLE", "PAUSED", "ERROR"].includes(state.status);
  const isSimulation = state.mode === "SIMULATION";
  const statusColor = STATUS_COLOR[state.status] ?? "#363634";

  return (
    <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, overflow: "hidden", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "#D6FF34",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 900, color: "#000",
          }}>Y</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>YO Agent</div>
            <div style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.15em" }}>Yield Optimizer</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: statusColor,
            boxShadow: isActive ? `0 0 6px ${statusColor}60` : "none",
            animation: isActive ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: statusColor, letterSpacing: "0.06em" }}>
            {state.status}
          </span>
        </div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Mode banner */}
        <div style={{
          padding: "6px 10px", borderRadius: 7, textAlign: "center",
          background: isSimulation ? "rgba(255,175,79,0.06)" : "rgba(0,255,139,0.06)",
          border: `1px solid ${isSimulation ? "rgba(255,175,79,0.15)" : "rgba(0,255,139,0.15)"}`,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: isSimulation ? "#FFAF4F" : "#00FF8B", letterSpacing: "0.05em" }}>
            {isSimulation ? "SIMULATION — no real transactions" : "LIVE — mainnet transactions enabled"}
          </span>
        </div>

        {/* Start / Stop */}
        {!isActive ? (
          <button
            disabled={isStarting}
            onClick={onStart}
            style={{
              width: "100%", padding: "9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: "1px solid rgba(214,255,52,0.3)", background: "rgba(214,255,52,0.08)",
              color: "#D6FF34", cursor: isStarting ? "wait" : "pointer",
              letterSpacing: "0.05em", opacity: isStarting ? 0.6 : 1, transition: "all 0.15s",
            }}
          >
            {isStarting ? "Starting..." : "Start YO Agent"}
          </button>
        ) : (
          <button
            onClick={() => onAction("stop")}
            style={{
              width: "100%", padding: "9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: "1px solid #2a2a28", background: "#111",
              color: "#a0a0a0", cursor: "pointer", letterSpacing: "0.05em",
            }}
          >
            Stop Agent
          </button>
        )}

        {startError && (
          <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(255,85,85,0.06)", border: "1px solid rgba(255,85,85,0.2)" }}>
            <p style={{ fontSize: 10, color: "#FF5555", margin: 0, fontFamily: "var(--font-mono)", lineHeight: 1.4 }}>{startError}</p>
          </div>
        )}

        <button
          onClick={() => onAction("reset")}
          style={{
            width: "100%", padding: "6px", borderRadius: 8, fontSize: 11,
            border: "1px solid #1a1a18", background: "transparent", color: "#363634", cursor: "pointer",
          }}
        >
          Reset logs
        </button>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 4 }}>
          {[
            { label: "Scans",     value: state.scansPerformed },
            { label: "Trades",    value: state.tradesPerformed },
            { label: "Positions", value: state.positions.filter(p => p.shares !== "0").length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#050504", borderRadius: 8, padding: "10px 8px", textAlign: "center", border: "1px solid #0d0d0b" }}>
              <div style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#a0a0a0" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Last summary */}
        {state.lastSummary && (
          <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(214,255,52,0.03)", border: "1px solid rgba(214,255,52,0.08)" }}>
            <p style={{ fontSize: 10, color: "#525252", margin: 0, lineHeight: 1.5 }}>{state.lastSummary}</p>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
