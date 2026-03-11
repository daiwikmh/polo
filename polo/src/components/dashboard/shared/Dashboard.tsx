"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import Sidebar from "./Sidebar";

// Guardian imports (unchanged)
import AgentPanel from "../guardian/AgentPanel";
import StatsCards from "../guardian/StatsCards";
import TickChart from "../guardian/TickChart";
import RiskGauge from "../guardian/RiskGauge";
import ActivityLog from "../guardian/ActivityLog";
import ControlPanel from "../guardian/ControlPanel";
import EvacuationPanel from "../guardian/EvacuationPanel";
import type { AgentState } from "@/types";

// YO Protocol imports
import YoStatsCards from "../yo/YoStatsCards";
import YoVaultScanner from "../yo/YoVaultScanner";
import YoMerklPanel from "../yo/YoMerklPanel";
import YoAgentPanel from "../yo/YoAgentPanel";
import YoAgentControlPanel from "../yo/YoAgentControlPanel";
import type { YoAgentState } from "@/lib/yo/yoAgent";

const INITIAL_GUARDIAN: AgentState = {
  status: "IDLE",
  lastCheck: 0,
  lastRisk: null,
  evacuationHistory: [],
  logs: [],
  uptime: 0,
  checksPerformed: 0,
};

const INITIAL_YO_AGENT: YoAgentState = {
  status: "IDLE",
  mode: "SIMULATION",
  agentAddress: "",
  logs: [],
  uptime: 0,
  scansPerformed: 0,
  tradesPerformed: 0,
  lastScan: 0,
  positions: [],
  tokenBalances: [],
  tradeHistory: [],
  lastSummary: "",
};

export default function Dashboard() {
  const [guardianState, setGuardianState] = useState<AgentState>(INITIAL_GUARDIAN);
  const [yoAgentState, setYoAgentState] = useState<YoAgentState>(INITIAL_YO_AGENT);
  const [mode, setMode] = useState<"guardian" | "yield">("yield");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Poll YO agent state every 3s when yield mode active
  useEffect(() => {
    if (mode !== "yield") return;
    const poll = async () => {
      try {
        const res = await fetch("/api/yo-agent");
        if (res.ok) setYoAgentState(await res.json());
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [mode]);

  const handleYoAgentAction = useCallback(async (action: string, data?: Record<string, unknown>): Promise<string | null> => {
    try {
      const postRes = await fetch("/api/yo-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (!postRes.ok) {
        const body = await postRes.json().catch(() => ({}));
        return (body as { error?: string }).error ?? `HTTP ${postRes.status}`;
      }
      // Immediately refresh state
      const res = await fetch("/api/yo-agent");
      if (res.ok) setYoAgentState(await res.json());
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Network error";
    }
  }, []);

  const handleStart = useCallback(async () => {
    setStartError(null);
    setIsStarting(true);
    const err = await handleYoAgentAction("start", { mode: yoAgentState.mode });
    setIsStarting(false);
    if (err) setStartError(err);
  }, [handleYoAgentAction, yoAgentState.mode]);

  // Guardian polling (unchanged)
  const handleGuardianAction = async (action: string, data?: Record<string, unknown>) => {
    try {
      await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
    } catch (e) { console.error(e); }
  };

  const isYield = mode === "yield";

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      background: "#000",
    }}>
      {/* Sidebar */}
      {leftOpen && (
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          simulationMode={yoAgentState.mode}
          onSimulationModeChange={(m) => handleYoAgentAction("set-mode", { mode: m })}
        />
      )}

      {/* Main content */}
      <main
        className="yo-right-panel"
        style={{
          flex: 1,
          minWidth: 0,
          transition: "margin 0.3s",
          marginLeft: leftOpen ? 220 : 0,
          overflowY: "auto",
        }}
      >
        {/* Top bar */}
        <header style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid #1a1a18",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              style={{
                padding: 6, borderRadius: 8, border: "none", background: "none",
                cursor: "pointer", color: "#525252", transition: "color 0.15s",
              }}
            >
              {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
                {isYield ? "YO Yield" : "Guardian"}
              </h2>
              <p style={{ fontSize: 10, color: "#525252", margin: 0, marginTop: 1 }}>
                {isYield ? "ERC-4626 Vaults · Base Chain · Partner 9999" : "Autonomous LP Guardian"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Live indicator */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              background: "#0a0a08",
              border: "1px solid #1a1a18",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isYield ? "#D6FF34" : "#525252",
                boxShadow: isYield ? "0 0 6px rgba(214,255,52,0.5)" : "none",
                animation: isYield ? "pulse 2s infinite" : "none",
              }} />
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#525252" }}>
                {isYield ? "LIVE" : "IDLE"}
              </span>
            </div>

            <button
              onClick={() => setRightOpen(!rightOpen)}
              style={{
                padding: 6, borderRadius: 8, border: "none", background: "none",
                cursor: "pointer", color: "#525252",
              }}
            >
              {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {isYield ? (
            <>
              <YoStatsCards />
              <YoVaultScanner />

              {/* Merkl + Agent row */}
              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
                <YoMerklPanel />
                <div style={{
                  background: "#0a0a08",
                  border: "1px solid #1a1a18",
                  borderRadius: 14,
                  padding: "18px",
                  minHeight: 320,
                }}>
                  <YoAgentPanel state={yoAgentState} />
                </div>
              </div>
            </>
          ) : (
            <>
              <StatsCards state={guardianState} />
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <TickChart risk={guardianState.lastRisk} />
                </div>
                <RiskGauge risk={guardianState.lastRisk} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <ControlPanel state={guardianState} onAction={handleGuardianAction} />
                <div className="col-span-2">
                  <ActivityLog logs={guardianState.logs} />
                </div>
              </div>
              <EvacuationPanel evacuations={guardianState.evacuationHistory} />
            </>
          )}
        </div>
      </main>

      {/* Right panel — YO Agent control */}
      {rightOpen && isYield && (
        <aside className="yo-right-panel" style={{
          width: 300,
          flexShrink: 0,
          height: "100vh",
          overflowY: "scroll",
          padding: "12px 12px 12px 0",
        }}>
          <YoAgentControlPanel state={yoAgentState} onAction={handleYoAgentAction} />
        </aside>
      )}

      {rightOpen && !isYield && (
        <aside style={{
          width: 320,
          flexShrink: 0,
          margin: "12px 12px 12px 0",
          position: "sticky",
          top: 12,
          alignSelf: "flex-start",
        }}>
          <div className="card">
            <AgentPanel state={guardianState} />
          </div>
        </aside>
      )}
    </div>
  );
}

