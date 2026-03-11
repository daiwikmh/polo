"use client";

import WalletButton from "./WalletButton";

// YO wordmark — black on neon
const Pologo = () => (
  <div style={{
    width: 36,
    height: 36,
    borderRadius: 8,
    background: "#D6FF34",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 700,
    color: "#000",
    letterSpacing: "-0.04em",
    flexShrink: 0,
  }}>
    yo
  </div>
);

export default function Sidebar({
  mode,
  onModeChange,
  simulationMode = "SIMULATION",
  onSimulationModeChange,
}: {
  mode: "guardian" | "yield";
  onModeChange: (mode: "guardian" | "yield") => void;
  simulationMode?: "SIMULATION" | "LIVE";
  onSimulationModeChange?: (mode: "SIMULATION" | "LIVE") => void;
}) {
  const isYield = mode === "yield";

  return (
    <aside style={{
      width: 220,
      height: "100vh",
      background: "#000",
      borderRight: "1px solid #1a1a18",
      display: "flex",
      flexDirection: "column",
      position: "fixed",
      left: 0,
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{
        padding: "20px 18px 16px",
        borderBottom: "1px solid #1a1a18",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Pologo />
          <div>
            <h1 style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.03em",
              margin: 0,
            }}>
              polo
            </h1>
            <p style={{
              fontSize: 9,
              color: "#363634",
              textTransform: "uppercase",
              letterSpacing: "0.25em",
              margin: 0,
              marginTop: 1,
            }}>
              yield optimizer
            </p>
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ padding: "12px 12px 8px" }}>
        <div style={{
          display: "flex",
          background: "#0a0a08",
          borderRadius: 10,
          padding: 3,
          gap: 2,
          border: "1px solid #1a1a18",
        }}>
          <button
            onClick={() => onModeChange("yield")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid",
              cursor: "pointer",
              background: mode === "yield" ? "rgba(214,255,52,0.08)" : "transparent",
              color: mode === "yield" ? "#D6FF34" : "#525252",
              borderColor: mode === "yield" ? "rgba(214,255,52,0.2)" : "transparent",
              letterSpacing: "0.03em",
              transition: "all 0.15s",
            }}
          >
            Yielder
          </button>
          <button
            onClick={() => onModeChange("guardian")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid",
              cursor: "pointer",
              background: mode === "guardian" ? "rgba(255,255,255,0.04)" : "transparent",
              color: mode === "guardian" ? "#a0a0a0" : "#525252",
              borderColor: mode === "guardian" ? "#2a2a28" : "transparent",
              letterSpacing: "0.03em",
              transition: "all 0.15s",
            }}
          >
            Guardian
          </button>
        </div>
      </div>

      {/* Nav section label */}
      <div style={{ padding: "12px 18px 6px" }}>
        <span style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.2em" }}>
          {isYield ? "Vaults · Base" : "Position Monitor"}
        </span>
      </div>

      {/* Vault links */}
      {isYield && (
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { label: "yoUSD", sub: "USDC", color: "#00FF8B" },
            { label: "yoETH", sub: "WETH", color: "#D6FF34" },
            { label: "yoBTC", sub: "cbBTC", color: "#FFAF4F" },
            { label: "yoEUR", sub: "EURC", color: "#4E6FFF" },
          ].map((v) => (
            <div
              key={v.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "default",
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: v.color,
                flexShrink: 0,
                opacity: 0.7,
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#a0a0a0" }}>{v.label}</span>
              <span style={{ fontSize: 10, color: "#363634", marginLeft: "auto" }}>{v.sub}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Simulation / Live toggle (yield mode only) */}
      {isYield && onSimulationModeChange && (
        <div style={{ margin: "0 12px 10px" }}>
          <div style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#0a0a08",
            border: "1px solid #1a1a18",
          }}>
            <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 8px" }}>
              Agent Mode
            </p>
            <div style={{ display: "flex", background: "#050504", borderRadius: 8, padding: 2, gap: 2, border: "1px solid #111" }}>
              <button
                onClick={() => onSimulationModeChange("SIMULATION")}
                style={{
                  flex: 1, padding: "6px 4px", borderRadius: 6,
                  fontSize: 10, fontWeight: 700, border: "1px solid",
                  cursor: "pointer", letterSpacing: "0.03em",
                  background: simulationMode === "SIMULATION" ? "rgba(255,175,79,0.08)" : "transparent",
                  color: simulationMode === "SIMULATION" ? "#FFAF4F" : "#363634",
                  borderColor: simulationMode === "SIMULATION" ? "rgba(255,175,79,0.2)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                SIM
              </button>
              <button
                onClick={() => onSimulationModeChange("LIVE")}
                style={{
                  flex: 1, padding: "6px 4px", borderRadius: 6,
                  fontSize: 10, fontWeight: 700, border: "1px solid",
                  cursor: "pointer", letterSpacing: "0.03em",
                  background: simulationMode === "LIVE" ? "rgba(0,255,139,0.08)" : "transparent",
                  color: simulationMode === "LIVE" ? "#00FF8B" : "#363634",
                  borderColor: simulationMode === "LIVE" ? "rgba(0,255,139,0.2)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                LIVE
              </button>
            </div>
            <p style={{ fontSize: 9, color: "#363634", margin: "6px 0 0", lineHeight: 1.4 }}>
              {simulationMode === "LIVE"
                ? "Real transactions on mainnet"
                : "Simulated — logs only, no trades"}
            </p>
          </div>
        </div>
      )}

      {/* Wallet */}
      <div style={{ borderTop: "1px solid #1a1a18" }}>
        <WalletButton />
      </div>

      {/* Merkl indicator */}
      <div style={{
        margin: "0 12px 10px",
        padding: "12px",
        borderRadius: 10,
        background: "rgba(214,255,52,0.04)",
        border: "1px solid rgba(214,255,52,0.08)",
      }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(214,255,52,0.6)", margin: "0 0 4px" }}>
          Merkl Rewards
        </p>
        <p style={{ fontSize: 10, color: "#525252", margin: 0, lineHeight: 1.5 }}>
          Earn additional rewards on Base via Merkl campaigns.
        </p>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#D6FF34",
            boxShadow: "0 0 6px rgba(214,255,52,0.5)",
            animation: "pulse 2s infinite",
          }} />
          <span style={{ fontSize: 10, color: "#D6FF34" }}>Active · Base</span>
        </div>
      </div>

      {/* Powered by */}
      <div style={{
        padding: "10px 18px",
        borderTop: "1px solid #1a1a18",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Powered by
        </span>
        <div style={{
          padding: "3px 8px",
          borderRadius: 5,
          background: "#D6FF34",
          fontSize: 9,
          fontWeight: 700,
          color: "#000",
          letterSpacing: "0.04em",
        }}>
          YO
        </div>
      </div>

      
    </aside>
  );
}
