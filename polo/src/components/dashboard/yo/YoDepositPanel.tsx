"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDeposit, useRedeem, useUserPosition, useShareBalance, useVaults } from "@yo-protocol/react";
import { parseUnits, formatUnits } from "viem";
import { YO_VAULTS, type YoVaultId, formatYield } from "@/lib/yo/vaults";

const VAULT_COLORS: Record<string, string> = {
  yoUSD: "#00FF8B",
  yoETH: "#D6FF34",
  yoBTC: "#FFAF4F",
  yoEUR: "#4E6FFF",
};

export default function YoDepositPanel({
  vaultId,
  onClose,
}: {
  vaultId: YoVaultId;
  onClose: () => void;
}) {
  const cfg = YO_VAULTS.find((v) => v.id === vaultId)!;
  const color = VAULT_COLORS[vaultId] ?? "#D6FF34";
  const { address } = useAccount();

  const [tab, setTab] = useState<"deposit" | "redeem">("deposit");
  const [amount, setAmount] = useState("");

  const { vaults } = useVaults();
  const vault = vaults.find((v) => v.id === vaultId && v.chain.id === 8453);
  const { position } = useUserPosition(vaultId);
  const { shares: shareBalance } = useShareBalance(vaultId);

  const { deposit, step: depositStep, isLoading: isDepositing, reset: resetDeposit } = useDeposit({
    vault: vaultId,
    slippageBps: 50,
    onError: (e) => console.error("Deposit error:", e),
  });

  const { redeem, step: redeemStep, isLoading: isRedeeming, instant, reset: resetRedeem } = useRedeem({
    vault: vaultId,
    onError: (e) => console.error("Redeem error:", e),
  });

  const apy7d = vault?.yield?.["7d"];

  const handleDeposit = async () => {
    if (!address || !amount) return;
    try {
      const parsed = parseUnits(amount, cfg.decimals);
      await deposit({ token: cfg.underlyingAddress, amount: parsed, chainId: 8453 });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRedeem = async () => {
    if (!address || !amount || shareBalance == null) return;
    try {
      // Interpret amount as share amount
      const parsed = parseUnits(amount, cfg.decimals);
      await redeem(parsed);
    } catch (e) {
      console.error(e);
    }
  };

  const isActive = tab === "deposit" ? isDepositing : isRedeeming;
  const step = tab === "deposit" ? depositStep : redeemStep;

  const stepLabels: Record<string, string> = {
    idle: "Ready",
    "switching-chain": "Switching to Base…",
    approving: "Approving token…",
    depositing: "Depositing…",
    redeeming: "Redeeming…",
    waiting: "Confirming…",
    success: "Success",
    error: "Error",
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* Vault info row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}14`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            color,
          }}>
            {cfg.underlying[0]}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{cfg.id}</div>
            <div style={{ fontSize: 11, color: "#525252" }}>
              7d APY: <span style={{ color, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{formatYield(apy7d)}</span>
            </div>
          </div>
        </div>

        {position && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Position</div>
            <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "#a0a0a0", marginTop: 2 }}>
              {formatUnits(position.assets, cfg.decimals)} {cfg.underlying}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        background: "#000",
        borderRadius: 10,
        padding: 3,
        gap: 2,
        marginBottom: 16,
        border: "1px solid #1a1a18",
      }}>
        {(["deposit", "redeem"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(""); resetDeposit?.(); resetRedeem?.(); }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid",
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: tab === t ? `${color}10` : "transparent",
              color: tab === t ? color : "#525252",
              borderColor: tab === t ? `${color}30` : "transparent",
              transition: "all 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div style={{
        background: "#000",
        border: `1px solid ${amount ? color + "30" : "#1a1a18"}`,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 12,
        transition: "border-color 0.15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#525252", textTransform: "uppercase", letterSpacing: "0.08em" }}>Amount</span>
          {tab === "redeem" && shareBalance != null && (
            <button
              onClick={() => setAmount(formatUnits(shareBalance, cfg.decimals))}
              style={{
                fontSize: 10,
                color: color,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              MAX: {Number(formatUnits(shareBalance, cfg.decimals)).toFixed(4)}
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          />
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#a0a0a0",
            background: "#0d0d0b",
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #1e1e1c",
          }}>
            {tab === "redeem" ? `yo${cfg.underlying}` : cfg.underlying}
          </span>
        </div>
      </div>

      {/* No wallet */}
      {!address && (
        <p style={{ fontSize: 11, color: "#525252", marginBottom: 12, textAlign: "center" }}>
          Connect wallet to deposit or redeem
        </p>
      )}

      {/* Step indicator */}
      {step !== "idle" && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
          padding: "8px 12px",
          borderRadius: 8,
          background: step === "success" ? "rgba(214,255,52,0.06)" : step === "error" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${step === "success" ? "rgba(214,255,52,0.15)" : step === "error" ? "rgba(239,68,68,0.15)" : "#1e1e1c"}`,
        }}>
          {isActive && (
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }} />
          )}
          <span style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: step === "success" ? "#D6FF34" : step === "error" ? "#ef4444" : "#a0a0a0",
          }}>
            {stepLabels[step] ?? step}
          </span>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={tab === "deposit" ? handleDeposit : handleRedeem}
        disabled={isActive || !address || !amount}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 10,
          border: `1px solid ${color}40`,
          background: `${color}10`,
          color: isActive || !address || !amount ? "#525252" : color,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: isActive || !address || !amount ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}
      >
        {isActive ? stepLabels[step] ?? "Processing…" : tab === "deposit" ? `Deposit ${cfg.underlying}` : `Redeem yo${cfg.underlying}`}
      </button>

      {instant === false && (
        <p style={{ fontSize: 10, color: "#525252", marginTop: 8, textAlign: "center" }}>
          Redemption queued — check pending status in your position.
        </p>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
