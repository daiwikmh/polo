"use client";

import type { YoAgentState } from "@/lib/yo/yoAgent";
import type { LogEntry } from "@/types";

const LEVEL_COLOR: Record<string, string> = {
  INFO:    "#363634",
  WARN:    "#FFAF4F",
  ERROR:   "#FF5555",
  SUCCESS: "#00FF8B",
};

function LogLine({ log }: { log: LogEntry }) {
  const ts = new Date(log.timestamp).toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#2a2a28", flexShrink: 0, marginTop: 1 }}>
        {ts}
      </span>
      <span style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        color: LEVEL_COLOR[log.level] ?? "#363634",
        lineHeight: 1.5, wordBreak: "break-word",
      }}>
        {log.message}
      </span>
    </div>
  );
}

export default function YoAgentPanel({ state }: { state: YoAgentState }) {
  // Show last 18 logs, newest first, no scroll
  const visible = state.logs.slice(0, 18);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Agent Logs
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 99, fontFamily: "var(--font-mono)",
            border: "1px solid #1e1e1c", color: "#aaaaa2", letterSpacing: "0.05em",
          }}>
            {state.status}
          </span>
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 99,
            background: state.mode === "LIVE" ? "rgba(0,255,139,0.08)" : "rgba(255,175,79,0.08)",
            border: `1px solid ${state.mode === "LIVE" ? "rgba(0,255,139,0.15)" : "rgba(255,175,79,0.15)"}`,
            color: state.mode === "LIVE" ? "#00FF8B" : "#FFAF4F",
            fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
          }}>
            {state.mode}
          </span>
        </div>
      </div>

      {/* Log lines — no scroll, fixed list */}
      <div style={{
        background: "#050504", borderRadius: 8, border: "1px solid #0d0d0b",
        padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1,
        color: "aaaaa2"
      }}>
        {visible.length === 0 ? (
          <span style={{ fontSize: 11, color: "#aaaaa2", fontFamily: "var(--font-mono)" }}>
            Waiting for agent to start...
          </span>
        ) : (
          visible.map((log) => <LogLine key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
