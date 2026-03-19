"use client";

import { Play, Square, RotateCcw, Shield } from "lucide-react";
import type { GuardianAgentState } from "@/lib/guardian/agent";

export default function ControlPanel({
  state,
  onAction,
  isStarting,
  onStart,
}: {
  state: GuardianAgentState;
  onAction: (action: string, data?: Record<string, unknown>) => void;
  isStarting?: boolean;
  onStart?: () => void;
}) {
  const isRunning = !["IDLE", "PAUSED", "ERROR"].includes(state.status);

  return (
    <div className="card p-5">
      <h3 className="control-heading">Guardian Control</h3>

      <div className="grid grid-cols-2 gap-2">
        {!isRunning ? (
          <button
            onClick={onStart ?? (() => onAction("start", { mode: state.mode }))}
            disabled={isStarting}
            className="btn btn-start col-span-2"
          >
            <Play className="w-3.5 h-3.5" /> {isStarting ? "Starting..." : "Start Guardian"}
          </button>
        ) : (
          <button onClick={() => onAction("stop")} className="btn btn-stop col-span-2">
            <Square className="w-3.5 h-3.5" /> Stop Guardian
          </button>
        )}

        <button onClick={() => onAction("reset")} className="btn btn-ghost col-span-2">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="powered-by">
        <p className="powered-by-label">Protecting</p>
        <div className="flex items-center gap-2">
          <div className="lifi-badge" style={{ background: "#D6FF34", color: "#000" }}>YO</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>YO Protocol Vaults</p>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
              <Shield className="w-3 h-3 inline mr-1" style={{ verticalAlign: "-2px" }} />
              ERC-4626 · Multi-chain
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
