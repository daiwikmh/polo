"use client";

import type { YieldAgentState } from "@/types";

export default function YieldControlPanel({
  state,
  onAction,
}: {
  state: YieldAgentState;
  onAction: (action: string, data?: Record<string, unknown>) => void;
}) {
  const isRunning = !["IDLE", "PAUSED", "ERROR"].includes(state.status);
  const isDryRun = state.mode === "DRY_RUN";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="control-heading" style={{ marginBottom: 0 }}>Agent Control</h3>
        <span className="jp-label">Control</span>
      </div>

      {/* Mode banner */}
      <div className={`mode-banner ${isDryRun ? "dry-run" : "live-mode"} mb-3`}>
        {isDryRun ? "SIMULATION — no transactions broadcast" : "LIVE — real transactions"}
      </div>

      <div className="flex flex-col gap-2">
        {!isRunning ? (
          <button
            onClick={() => onAction("start", { mode: state.mode })}
            className="btn btn-neon"
          >
            Start Yield Agent
          </button>
        ) : (
          <button onClick={() => onAction("stop")} className="btn btn-stop">
            Stop Agent
          </button>
        )}

        <button onClick={() => onAction("reset")} className="btn btn-ghost">
          Reset
        </button>
      </div>
    </div>
  );
}
