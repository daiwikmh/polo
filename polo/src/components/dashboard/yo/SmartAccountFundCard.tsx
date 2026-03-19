"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { Copy, Check, ExternalLink } from "lucide-react";
import { wagmiConfig } from "@/lib/shared/wagmi";
import { toMultichainNexusAccount, getMEEVersion, MEEVersion } from "@biconomy/abstractjs";
import { http } from "viem";
import { base } from "viem/chains";

export default function SmartAccountFundCard() {
  const { address, isConnected } = useAccount();
  const [smartAddress, setSmartAddress] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;

    // Check if session already active
    fetch(`/api/session?address=${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.session?.active && new Date(data.session.expiresAt) > new Date()) {
          setSessionActive(true);
          setSmartAddress(data.session.smartAccountAddress);
        }
      })
      .catch(() => {});

    // Compute counterfactual address
    getWalletClient(wagmiConfig).then((wc) => {
      if (!wc) return;
      return toMultichainNexusAccount({
        signer: wc as never,
        chainConfigurations: [{ chain: base, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) }],
      });
    }).then((acct) => {
      if (acct) setSmartAddress(acct.addressOn(base.id));
    }).catch(() => {});
  }, [address]);

  if (!isConnected || !smartAddress) return null;

  const short = `${smartAddress.slice(0, 8)}...${smartAddress.slice(-6)}`;
  // Relay link to fund via Relay.link bridge
  const fundUrl = `https://relay.link/bridge/base?currency=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&toAddress=${smartAddress}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(smartAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: "#0a0a08",
      border: `1px solid ${sessionActive ? "rgba(0,255,139,0.12)" : "rgba(255,175,79,0.15)"}`,
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 0,
    }}>
      <p style={{ fontSize: 9, color: sessionActive ? "#00FF8B" : "#FFAF4F", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 10px", fontWeight: 700 }}>
        {sessionActive ? "Smart Account" : "Fund Smart Account"}
      </p>

      {/* Address row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        background: "#050504",
        borderRadius: 8,
        border: "1px solid #111",
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a0a0a0", flex: 1 }}>{short}</span>
        <button
          onClick={handleCopy}
          title="Copy address"
          style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#00FF8B" : "#525252", padding: 2, flexShrink: 0 }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!sessionActive && (
        <p style={{ fontSize: 10, color: "#525252", margin: "0 0 10px", lineHeight: 1.5 }}>
          Send at least <span style={{ color: "#FFAF4F" }}>$1 USDC</span> on Base to this address to cover activation fees (~$0.055).
        </p>
      )}

      <a
        href={fundUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          padding: "8px",
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          border: `1px solid ${sessionActive ? "rgba(0,255,139,0.2)" : "rgba(255,175,79,0.25)"}`,
          background: sessionActive ? "rgba(0,255,139,0.06)" : "rgba(255,175,79,0.06)",
          color: sessionActive ? "#00FF8B" : "#FFAF4F",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <ExternalLink className="w-3 h-3" />
        {sessionActive ? "Bridge USDC to Smart Account" : "Fund via Relay"}
      </a>
    </div>
  );
}
