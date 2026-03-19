"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Copy, Check, ExternalLink } from "lucide-react";

export default function SmartAccountFundCard({ smartAccountAddress }: { smartAccountAddress?: string }) {
  const { isConnected } = useAccount();
  const [copied, setCopied] = useState(false);

  const smartAddress = smartAccountAddress ?? null;
  const sessionActive = false; // purely display — session state lives in ProfileButton

  if (!isConnected || !smartAddress) return null;

  const short = `${smartAddress.slice(0, 8)}...${smartAddress.slice(-6)}`;
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
