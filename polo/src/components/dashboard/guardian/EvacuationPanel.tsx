"use client";

import { CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import type { GuardianEvacRecord } from "@/lib/guardian/agent";

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

export default function EvacuationPanel({ evacuations }: { evacuations: GuardianEvacRecord[] }) {
  return (
    <div className="card p-5">
      <h3 className="evac-heading">Evacuation History</h3>

      {evacuations.length === 0 ? (
        <div className="evac-empty">No evacuations triggered. Vaults are within safe parameters.</div>
      ) : (
        <div className="space-y-2">
          {evacuations.slice(0, 20).map((evac, i) => (
            <div key={i} className="evac-row">
              <div className="flex items-center gap-3">
                {evac.error
                  ? <XCircle className="w-4 h-4" style={{ color: "var(--danger)" }} />
                  : <ShieldAlert className="w-4 h-4" style={{ color: "var(--warning)" }} />
                }
                <div>
                  <div className="flex items-center gap-2">
                    <span className="evac-chain">{evac.vaultId}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {CHAIN_NAMES[evac.chainId] ?? evac.chainId}
                    </span>
                    {evac.simulation && (
                      <span style={{ fontSize: 9, color: "#FFAF4F", fontWeight: 600 }}>SIM</span>
                    )}
                  </div>
                  <p className="evac-meta">
                    Redeemed: {evac.assetsRedeemed} | {evac.reason}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="evac-time">{new Date(evac.timestamp).toLocaleTimeString()}</p>
                {evac.txHash && <p className="evac-hash">{evac.txHash.slice(0, 10)}...</p>}
                {evac.error && <p className="evac-hash" style={{ color: "var(--danger)" }}>Failed</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
