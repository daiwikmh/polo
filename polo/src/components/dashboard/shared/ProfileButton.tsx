"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { User, Shield, Loader2, X, Check, AlertTriangle } from "lucide-react";
import { wagmiConfig } from "@/lib/shared/wagmi";
import {
  toMultichainNexusAccount,
  createMeeClient,
  getMEEVersion,
  MEEVersion,
  type SessionDetail,
} from "@biconomy/abstractjs";
import { http, parseUnits, toFunctionSelector } from "viem";
import { base } from "viem/chains";
import {
  YO_GATEWAY,
  YO_VAULTS,
  BASE_TOKENS,
  SESSION_DURATION_SECONDS,
  MAX_GAS_PAYMENT,
  FEE_TOKEN_CHAIN_ID,
} from "@/lib/biconomy/config";

type SessionState = {
  id: string;
  smartAccountAddress: string;
  active: boolean;
  expiresAt: string;
} | null;

type Step = "idle" | "creating-account" | "granting-session" | "saving" | "done" | "error";

export default function ProfileButton() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionState>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [predictedAddress, setPredictedAddress] = useState<string | null>(null);

  // Fetch existing session
  useEffect(() => {
    if (!address) { setSession(null); return; }
    fetch(`/api/session?address=${address}`)
      .then((r) => r.json())
      .then((data) => setSession(data.session ?? null))
      .catch(() => setSession(null));
  }, [address, open]);

  // Compute predicted smart account address when modal opens (counterfactual, no tx needed)
  useEffect(() => {
    if (!open || !address || session) return;
    getWalletClient(wagmiConfig).then((wc) => {
      if (!wc) return;
      return toMultichainNexusAccount({
        signer: wc as never,
        chainConfigurations: [{ chain: base, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) }],
      });
    }).then((acct) => {
      if (acct) setPredictedAddress(acct.addressOn(base.id));
    }).catch(() => {});
  }, [open, address, session]);

  // Activate smart account + grant session
  const handleActivate = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    setStep("creating-account");

    try {
      // Get wallet client from wagmi core (more reliable than the hook)
      const wc = await getWalletClient(wagmiConfig);
      if (!wc) throw new Error("Wallet not available. Please reconnect your wallet.");
      // Step 1: Create user's multichain Nexus account
      // Cast walletClient to satisfy Biconomy's signer type (wagmi's WalletClient is compatible at runtime)
      const userAccount = await toMultichainNexusAccount({
        signer: wc as never,
        chainConfigurations: [
          {
            chain: base,
            transport: http(),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
        ],
      });

      const smartAccountAddress = userAccount.addressOn(base.id);
      const meeClient = await createMeeClient({ account: userAccount });

      // Step 2: Build session actions for YO Gateway
      setStep("granting-session");

      // Deposit permission on all YO vaults
      const vaultAddresses = Object.values(YO_VAULTS);
      const depositActions = vaultAddresses.map((vaultAddr) =>
        userAccount.buildSessionAction({
          type: "custom",
          data: {
            chainIds: [base.id],
            contractAddress: vaultAddr,
            functionSignature: toFunctionSelector("deposit(uint256,address)"),
          },
        }),
      );

      // Redeem permission on all YO vaults
      const redeemActions = vaultAddresses.map((vaultAddr) =>
        userAccount.buildSessionAction({
          type: "custom",
          data: {
            chainIds: [base.id],
            contractAddress: vaultAddr,
            functionSignature: toFunctionSelector("redeem(uint256,address,address)"),
          },
        }),
      );

      // Approve permission on underlying tokens (for YO Gateway)
      const tokenAddresses = Object.values(BASE_TOKENS);
      const approveActions = tokenAddresses.map((tokenAddr) =>
        userAccount.buildSessionAction({
          type: "custom",
          data: {
            chainIds: [base.id],
            contractAddress: tokenAddr,
            functionSignature: toFunctionSelector("approve(address,uint256)"),
          },
        }),
      );

      // Approve on YO Gateway itself
      const [gatewayApproveAction] = userAccount.buildSessionAction({
        type: "custom",
        data: {
          chainIds: [base.id],
          contractAddress: YO_GATEWAY,
          functionSignature: toFunctionSelector("approve(address,uint256)"),
        },
      });

      // Flatten all actions
      const allActions = [
        ...depositActions.flat(),
        ...redeemActions.flat(),
        ...approveActions.flat(),
        gatewayApproveAction,
      ];

      // Get the agent signer address from env (public info)
      const agentSignerRes = await fetch("/api/agent-signer");
      const agentSignerData = await agentSignerRes.json();
      const agentSignerAddress = agentSignerData.address;

      if (!agentSignerAddress) {
        throw new Error("Agent signer not configured on server");
      }

      // Step 3: Prepare and enable session
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

      const prepareQuote = await meeClient.getSessionQuote({
        mode: "PREPARE",
        enableSession: {
          redeemer: agentSignerAddress,
          actions: allActions,
          maxPaymentAmount: MAX_GAS_PAYMENT,
        },
        simulation: { simulate: true },
        feeToken: {
          address: BASE_TOKENS.USDC,
          chainId: FEE_TOKEN_CHAIN_ID,
        },
      });

      let sessionDetails: SessionDetail[] = [];

      if (prepareQuote) {
        const { hash } = await meeClient.executeSessionQuote(prepareQuote);
        await meeClient.waitForSupertransactionReceipt({ hash });

        if (prepareQuote.sessionDetails) {
          sessionDetails = prepareQuote.sessionDetails;
        }
      }

      // Step 4: Save to backend
      setStep("saving");

      const saveRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eoaAddress: address,
          smartAccountAddress,
          sessionDetails,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || "Failed to save session");
      }

      const saved = await saveRes.json();
      setSession(saved.session);
      setStep("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.slice(0, 150));
      setStep("error");
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Revoke session
  const handleRevoke = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      await fetch("/api/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoaAddress: address }),
      });
      setSession(null);
      setStep("idle");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [address]);

  if (!isConnected) return null;

  const isExpired = session?.expiresAt ? new Date(session.expiresAt) < new Date() : false;
  const hasActiveSession = session?.active && !isExpired;

  return (
    <>
      {/* Profile button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(214,255,52,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: hasActiveSession ? "rgba(0,255,139,0.1)" : "#0a0a08",
          border: `1px solid ${hasActiveSession ? "rgba(0,255,139,0.2)" : "#1a1a18"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {hasActiveSession
            ? <Shield className="w-3.5 h-3.5" style={{ color: "#00FF8B" }} />
            : <User className="w-3.5 h-3.5" style={{ color: "#525252" }} />
          }
        </div>
        <div style={{ textAlign: "left", minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: hasActiveSession ? "#00FF8B" : "#a0a0a0", margin: 0 }}>
            {hasActiveSession ? "Agent Active" : "Profile"}
          </p>
          <p style={{ fontSize: 9, color: "#363634", margin: 0, marginTop: 1 }}>
            {hasActiveSession ? "Smart Account" : "Set up agent"}
          </p>
        </div>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              maxHeight: "80vh",
              background: "#0a0a08",
              border: "1px solid #1a1a18",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1a1a18",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Agent Profile
                </h3>
                <p style={{ fontSize: 10, color: "#525252", margin: "2px 0 0" }}>
                  Biconomy Smart Account · Base
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#525252", padding: 4 }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "20px" }}>
              {/* Wallet info */}
              <div style={{
                padding: "12px 14px",
                background: "#050504",
                borderRadius: 10,
                border: "1px solid #111",
                marginBottom: 16,
              }}>
                <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>
                  Connected Wallet
                </p>
                <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#a0a0a0", margin: 0, wordBreak: "break-all" }}>
                  {address}
                </p>
              </div>

              {hasActiveSession ? (
                <>
                  {/* Active session info */}
                  <div style={{
                    padding: "14px",
                    background: "rgba(0,255,139,0.04)",
                    border: "1px solid rgba(0,255,139,0.15)",
                    borderRadius: 10,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Check className="w-4 h-4" style={{ color: "#00FF8B" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#00FF8B" }}>Smart Account Active</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
                          Smart Account
                        </p>
                        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a0a0a0", margin: 0, wordBreak: "break-all" }}>
                          {session.smartAccountAddress}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
                          Session Expires
                        </p>
                        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a0a0a0", margin: 0 }}>
                          {new Date(session.expiresAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6 }}>
                      <p style={{ fontSize: 9, color: "#525252", margin: 0, lineHeight: 1.5 }}>
                        Permissions: deposit, redeem on YO vaults (yoUSD, yoETH, yoBTC, yoEUR) + token approvals. Base chain only.
                      </p>
                    </div>
                  </div>

                  {/* How it works */}
                  <div style={{
                    padding: "12px 14px",
                    background: "#050504",
                    borderRadius: 10,
                    border: "1px solid #111",
                    marginBottom: 16,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#a0a0a0", margin: "0 0 8px" }}>How it works</p>
                    <p style={{ fontSize: 10, color: "#525252", margin: 0, lineHeight: 1.6 }}>
                      The agent uses session keys to deposit and redeem on your behalf. Your funds stay in your smart account — the agent never holds your tokens. Click "Start Agent" in the dashboard to begin.
                    </p>
                  </div>

                  <button
                    onClick={handleRevoke}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid rgba(255,85,85,0.2)",
                      background: "rgba(255,85,85,0.06)",
                      color: "#FF5555",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {loading ? "Revoking..." : "Revoke Session"}
                  </button>
                </>
              ) : (
                <>
                  {/* Not activated */}
                  <div style={{
                    padding: "14px",
                    background: "rgba(214,255,52,0.04)",
                    border: "1px solid rgba(214,255,52,0.1)",
                    borderRadius: 10,
                    marginBottom: 16,
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#D6FF34", margin: "0 0 8px" }}>
                      Activate Agent
                    </p>
                    <p style={{ fontSize: 10, color: "#525252", margin: 0, lineHeight: 1.6 }}>
                      Create a Biconomy smart account and grant the agent permission to deposit and redeem in YO vaults on your behalf. Your funds remain in your smart account at all times.
                    </p>
                  </div>

                  {/* Smart account address + fund notice */}
                  {predictedAddress && (
                    <div style={{
                      padding: "12px 14px",
                      background: "rgba(255,175,79,0.04)",
                      border: "1px solid rgba(255,175,79,0.15)",
                      borderRadius: 10,
                      marginBottom: 16,
                    }}>
                      <p style={{ fontSize: 9, color: "#FFAF4F", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>
                        Your Smart Account Address
                      </p>
                      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#a0a0a0", margin: "0 0 8px", wordBreak: "break-all" }}>
                        {predictedAddress}
                      </p>
                      <p style={{ fontSize: 10, color: "#FFAF4F", margin: 0, lineHeight: 1.5 }}>
                        Send at least $1 USDC to this address on Base before activating — fees (~$0.055) are paid from here.
                      </p>
                    </div>
                  )}

                  {/* Permissions summary */}
                  <div style={{
                    padding: "12px 14px",
                    background: "#050504",
                    borderRadius: 10,
                    border: "1px solid #111",
                    marginBottom: 16,
                  }}>
                    <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
                      Permissions Requested
                    </p>
                    {[
                      "Deposit into YO vaults (yoUSD, yoETH, yoBTC, yoEUR)",
                      "Redeem from YO vaults",
                      "Approve tokens for YO Gateway",
                      "Base chain only · 24-hour session",
                    ].map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#D6FF34", opacity: 0.6 }} />
                        <span style={{ fontSize: 10, color: "#a0a0a0" }}>{p}</span>
                      </div>
                    ))}
                  </div>

                  {/* Step indicator */}
                  {step !== "idle" && step !== "done" && (
                    <div style={{
                      padding: "10px 14px",
                      background: step === "error" ? "rgba(255,85,85,0.06)" : "rgba(214,255,52,0.04)",
                      border: `1px solid ${step === "error" ? "rgba(255,85,85,0.15)" : "rgba(214,255,52,0.1)"}`,
                      borderRadius: 8,
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}>
                      {step === "error" ? (
                        <AlertTriangle className="w-4 h-4" style={{ color: "#FF5555", flexShrink: 0 }} />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#D6FF34", flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 10, color: step === "error" ? "#FF5555" : "#a0a0a0" }}>
                        {step === "creating-account" && "Creating smart account..."}
                        {step === "granting-session" && "Granting session permissions — confirm in wallet..."}
                        {step === "saving" && "Saving session..."}
                        {step === "error" && (error || "Something went wrong")}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleActivate}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: "1px solid rgba(214,255,52,0.3)",
                      background: "rgba(214,255,52,0.08)",
                      color: "#D6FF34",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.5 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {loading ? "Processing..." : "Activate Smart Account"}
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
