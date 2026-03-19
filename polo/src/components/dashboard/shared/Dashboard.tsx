"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import Sidebar from "./Sidebar";

// Guardian imports — YO vault health monitoring
import AgentPanel from "../guardian/AgentPanel";
import StatsCards from "../guardian/StatsCards";
import TickChart from "../guardian/TickChart";
import RiskGauge from "../guardian/RiskGauge";
import ActivityLog from "../guardian/ActivityLog";
import ControlPanel from "../guardian/ControlPanel";
import EvacuationPanel from "../guardian/EvacuationPanel";
import type { GuardianAgentState } from "@/lib/guardian/agent";

// YO Protocol imports
import YoStatsCards from "../yo/YoStatsCards";
import YoVaultScanner from "../yo/YoVaultScanner";
import YoMerklPanel from "../yo/YoMerklPanel";
import YoAgentPanel from "../yo/YoAgentPanel";
import YoAgentControlPanel from "../yo/YoAgentControlPanel";
import SmartAccountFundCard from "../yo/SmartAccountFundCard";
import { getWalletClient } from "@wagmi/core";
import { wagmiConfig } from "@/lib/shared/wagmi";
import { toMultichainNexusAccount, getMEEVersion, MEEVersion } from "@biconomy/abstractjs";
import { http } from "viem";
import { base } from "viem/chains";
import type { YoAgentState } from "@/lib/yo/yoAgent";

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
  executionMode: "platform",
};

const INITIAL_GUARDIAN: GuardianAgentState = {
  status: "IDLE",
  mode: "SIMULATION",
  agentAddress: "",
  logs: [],
  uptime: 0,
  scansPerformed: 0,
  evacuationsPerformed: 0,
  lastScan: 0,
  lastSnapshot: null,
  evacuationHistory: [],
  lastSummary: "",
};

export default function Dashboard() {
  const { address: userWalletAddress } = useAccount();
  const [yoAgentState, setYoAgentState] = useState<YoAgentState>(INITIAL_YO_AGENT);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | undefined>();

  useEffect(() => {
    if (!userWalletAddress) return;
    // Check existing session first
    fetch(`/api/session?address=${userWalletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.session?.smartAccountAddress) {
          setSmartAccountAddress(data.session.smartAccountAddress);
          return;
        }
        // Compute counterfactual address
        return getWalletClient(wagmiConfig).then((wc) => {
          if (!wc) return;
          return toMultichainNexusAccount({
            signer: wc as never,
            chainConfigurations: [{ chain: base, transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL), version: getMEEVersion(MEEVersion.V2_1_0) }],
          });
        }).then((acct) => { if (acct) setSmartAccountAddress(acct.addressOn(base.id)); });
      })
      .catch(() => {});
  }, [userWalletAddress]);
  const [guardianState, setGuardianState] = useState<GuardianAgentState>(INITIAL_GUARDIAN);
  const [mode, setMode] = useState<"guardian" | "yield">("yield");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isGuardianStarting, setIsGuardianStarting] = useState(false);

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

  // Poll Guardian state every 3s when guardian mode active
  useEffect(() => {
    if (mode !== "guardian") return;
    const poll = async () => {
      try {
        const res = await fetch("/api/guardian");
        if (res.ok) setGuardianState(await res.json());
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [mode]);

  // ── YO Agent actions ──
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
    // Pass userAddress to trigger session-based execution when user has an active session
    const err = await handleYoAgentAction("start", {
      mode: yoAgentState.mode,
      ...(userWalletAddress ? { userAddress: userWalletAddress } : {}),
    });
    setIsStarting(false);
    if (err) setStartError(err);
  }, [handleYoAgentAction, yoAgentState.mode, userWalletAddress]);

  // ── Guardian actions ──
  const handleGuardianAction = useCallback(async (action: string, data?: Record<string, unknown>) => {
    try {
      await fetch("/api/guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      const res = await fetch("/api/guardian");
      if (res.ok) setGuardianState(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const handleGuardianStart = useCallback(async () => {
    setIsGuardianStarting(true);
    await handleGuardianAction("start", { mode: guardianState.mode });
    setIsGuardianStarting(false);
  }, [handleGuardianAction, guardianState.mode]);

  const isYield = mode === "yield";

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#000",
    }}>
      {/* Sidebar */}
      {leftOpen && (
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          simulationMode={isYield ? yoAgentState.mode : guardianState.mode}
          onSimulationModeChange={(m) =>
            isYield
              ? handleYoAgentAction("set-mode", { mode: m })
              : handleGuardianAction("set-mode", { mode: m })
          }
        />
      )}

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100vh",
          transition: "margin 0.3s",
          marginLeft: leftOpen ? 220 : 0,
          overflowY: "scroll",
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
                {isYield ? "ERC-4626 Vaults · Base Chain · Partner 9999" : "YO Vault Health Monitor · Multi-Chain"}
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
                background: (isYield ? yoAgentState.status : guardianState.status) !== "IDLE" ? "#D6FF34" : "#525252",
                boxShadow: (isYield ? yoAgentState.status : guardianState.status) !== "IDLE" ? "0 0 6px rgba(214,255,52,0.5)" : "none",
                animation: (isYield ? yoAgentState.status : guardianState.status) !== "IDLE" ? "pulse 2s infinite" : "none",
              }} />
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#525252" }}>
                {(isYield ? yoAgentState.status : guardianState.status) !== "IDLE" ? "LIVE" : "IDLE"}
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

              {/* Agent control + Log row */}
              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
                <YoMerklPanel
                  state={yoAgentState}
                  onAction={handleYoAgentAction}
                  isStarting={isStarting}
                  startError={startError}
                  onStart={handleStart}
                />
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
              {/* Row 1 — stat squares */}
              <StatsCards state={guardianState} />

              {/* Row 2 — chart + gauge & control */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
                <TickChart vaults={guardianState.lastSnapshot?.vaults ?? []} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <RiskGauge snapshot={guardianState.lastSnapshot} />
                  <ControlPanel
                    state={guardianState}
                    onAction={handleGuardianAction}
                    isStarting={isGuardianStarting}
                    onStart={handleGuardianStart}
                  />
                </div>
              </div>

              {/* Row 3 — activity log + evacuations */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ActivityLog logs={guardianState.logs} />
                <EvacuationPanel evacuations={guardianState.evacuationHistory} />
              </div>
            </>
          )}
        </div>
      </main>

      {/* Right panel — YO Agent control (yield) or Guardian info (guardian) */}
      {rightOpen && isYield && (
        <aside className="yo-right-panel" style={{
          width: 300,
          flexShrink: 0,
          height: "100vh",
          overflowY: "scroll",
          padding: "12px 12px 12px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <SmartAccountFundCard smartAccountAddress={smartAccountAddress} />
          <YoAgentControlPanel state={yoAgentState} onAction={handleYoAgentAction} smartAccountAddress={smartAccountAddress} />
        </aside>
      )}

      {rightOpen && !isYield && (
        <aside className="yo-right-panel" style={{
          width: 300,
          flexShrink: 0,
          height: "100vh",
          overflowY: "auto",
          padding: "12px 12px 12px 0",
        }}>
          <div className="card">
            <AgentPanel state={guardianState} />
          </div>
        </aside>
      )}
    </div>
  );
}
