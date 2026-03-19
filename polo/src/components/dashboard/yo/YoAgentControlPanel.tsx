"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { ERC20_ABI } from "@/lib/abi/aaveV3Pool";
import type { YoAgentState } from "@/lib/yo/yoAgent";

const FUND_TOKENS = [
  { symbol: "USDC",  decimals: 6,  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`, chainId: 8453, chainName: "Base" },
  { symbol: "WETH",  decimals: 18, address: "0x4200000000000000000000000000000000000006" as `0x${string}`, chainId: 8453, chainName: "Base" },
  { symbol: "cbBTC", decimals: 8,  address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as `0x${string}`, chainId: 8453, chainName: "Base" },
  { symbol: "EURC",  decimals: 6,  address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as `0x${string}`, chainId: 8453, chainName: "Base" },
] as const;
type FundToken = (typeof FUND_TOKENS)[number];

const VAULT_COLORS: Record<string, string> = {
  yoUSD: "#00FF8B", yoETH: "#D6FF34", yoBTC: "#FFAF4F",
  yoEUR: "#4E6FFF", yoGOLD: "#FFD700", yoUSDT: "#26A17B",
};

function AgentTokenBalance({ token, agentAddress }: { token: FundToken; agentAddress: string }) {
  const { data } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [agentAddress as `0x${string}`],
    query: { enabled: !!agentAddress, refetchInterval: 15000 },
  });
  const bal = data != null ? (Number(data as bigint) / 10 ** token.decimals) : null;
  if (!bal || bal === 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "#525252" }}>{token.symbol}</span>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#a0a0a0" }}>
        {bal.toFixed(token.decimals === 18 ? 6 : 4)}
      </span>
    </div>
  );
}

function FundWidget({ agentAddress }: { agentAddress: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [token, setToken] = useState<FundToken>(FUND_TOKENS[0]);
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);

  const amountRaw = (() => {
    const n = parseFloat(amount || "0");
    if (isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.floor(n * 10 ** token.decimals));
  })();
  const onWrongChain = isConnected && chainId !== token.chainId;

  const { data: walletBalance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => { if (isConfirmed) setDone(true); }, [isConfirmed]);

  const balFmt = walletBalance != null
    ? (Number(walletBalance as bigint) / 10 ** token.decimals).toFixed(token.decimals === 18 ? 6 : 4)
    : "—";
  const isProcessing = isPending || isConfirming || isSwitching;

  if (!isConnected) return (
    <p style={{ fontSize: 11, color: "#363634", textAlign: "center", margin: 0 }}>Connect wallet to fund</p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Token selector */}
      <div style={{ display: "flex", gap: 4 }}>
        {FUND_TOKENS.map((t) => (
          <button key={t.symbol}
            onClick={() => { setToken(t); setDone(false); reset(); setAmount(""); }}
            style={{
              flex: 1, padding: "5px 4px", borderRadius: 6, fontSize: 10, fontWeight: 700, border: "1px solid",
              cursor: "pointer", transition: "all 0.12s",
              background: token.symbol === t.symbol ? "rgba(214,255,52,0.08)" : "transparent",
              color: token.symbol === t.symbol ? "#D6FF34" : "#363634",
              borderColor: token.symbol === t.symbol ? "rgba(214,255,52,0.2)" : "#1a1a18",
            }}
          >{t.symbol}</button>
        ))}
      </div>

      <p style={{ fontSize: 10, color: "#363634", margin: 0 }}>
        Your {token.symbol}: <span style={{ fontFamily: "var(--font-mono)", color: "#525252" }}>{balFmt}</span>
      </p>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="number" value={amount} placeholder="0.0" min="0"
          onChange={(e) => { setAmount(e.target.value); setDone(false); }}
          style={{
            flex: 1, background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 7,
            padding: "7px 10px", fontSize: 13, fontFamily: "var(--font-mono)", color: "#fff", outline: "none",
          }}
        />
        <button
          onClick={() => setAmount(balFmt !== "—" ? balFmt : "")}
          style={{ padding: "7px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600, border: "1px solid #1a1a18", background: "#0a0a08", color: "#525252", cursor: "pointer" }}
        >MAX</button>
      </div>

      {onWrongChain ? (
        <button onClick={() => switchChain({ chainId: token.chainId })} disabled={isSwitching}
          style={{ width: "100%", padding: "8px", borderRadius: 7, fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,175,79,0.3)", background: "rgba(255,175,79,0.06)", color: "#FFAF4F", cursor: "pointer" }}>
          {isSwitching ? "Switching..." : `Switch to ${token.chainName}`}
        </button>
      ) : (
        <button
          disabled={isProcessing || amountRaw === 0n}
          onClick={done
            ? () => { setDone(false); setAmount(""); reset(); }
            : () => {
                if (!agentAddress || amountRaw === 0n) return;
                writeContract({ address: token.address, abi: ERC20_ABI, functionName: "transfer", args: [agentAddress as `0x${string}`, amountRaw] });
              }
          }
          style={{
            width: "100%", padding: "8px", borderRadius: 7, fontSize: 11, fontWeight: 700,
            border: `1px solid ${done ? "rgba(0,255,139,0.3)" : "rgba(214,255,52,0.2)"}`,
            background: done ? "rgba(0,255,139,0.06)" : "rgba(214,255,52,0.06)",
            color: done ? "#00FF8B" : "#D6FF34",
            cursor: isProcessing || amountRaw === 0n ? "not-allowed" : "pointer",
            opacity: isProcessing || amountRaw === 0n ? 0.5 : 1, transition: "all 0.15s",
          }}
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : done ? `Sent ✓` : `Send ${token.symbol} to Agent`}
        </button>
      )}

      {error && <p style={{ fontSize: 9, color: "#FF5555", fontFamily: "var(--font-mono)", margin: 0 }}>{error.message.split("\n")[0].slice(0, 80)}</p>}
    </div>
  );
}

export default function YoAgentControlPanel({
  state,
  smartAccountAddress,
}: {
  state: YoAgentState;
  onAction: (action: string, data?: Record<string, unknown>) => Promise<string | null>;
  smartAccountAddress?: string;
}) {
  // Smart account takes priority — it's what actually holds user funds
  const fundAddress = smartAccountAddress || state.agentAddress || "";
  const hasAddress = !!fundAddress;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Agent Profile */}
      <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "#D6FF34", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000" }}>Y</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Agent Wallet</div>
            {fundAddress
              ? <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#525252", marginTop: 1 }}>
                  {fundAddress.slice(0, 10)}…{fundAddress.slice(-6)}
                </div>
              : <div style={{ fontSize: 10, color: "#363634", marginTop: 1 }}>Start agent to reveal address</div>
            }
          </div>
          {fundAddress && (
            <button
              onClick={() => navigator.clipboard.writeText(fundAddress)}
              style={{ marginLeft: "auto", fontSize: 9, color: "#363634", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em" }}
            >COPY</button>
          )}
        </div>

        {/* Idle token balances */}
        {hasAddress && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #111" }}>
            <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>Idle Balances</p>
            {FUND_TOKENS.map((t) => (
              <AgentTokenBalance key={t.symbol} token={t} agentAddress={fundAddress} />
            ))}
            {state.tokenBalances.length === 0 && (
              <p style={{ fontSize: 10, color: "#363634", margin: 0 }}>No tokens held yet</p>
            )}
          </div>
        )}

        {/* Deposited in vaults */}
        {state.positions.some(p => p.shares !== "0") && (
          <div style={{ padding: "12px 16px" }}>
            <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>In YO Vaults</p>
            {state.positions.filter(p => p.shares !== "0").map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: VAULT_COLORS[p.vaultId] ?? "#525252" }} />
                  <span style={{ fontSize: 11, color: "#525252" }}>{p.vaultId}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: VAULT_COLORS[p.vaultId] ?? "#a0a0a0" }}>
                  {p.assetsHuman}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fund */}
      <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #111" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Fund Agent</span>
          <p style={{ fontSize: 9, color: "#363634", margin: "2px 0 0", lineHeight: 1.4 }}>
            Send tokens to the agent wallet on Base
          </p>
        </div>
        <div style={{ padding: "12px 16px" }}>
          {hasAddress
            ? <FundWidget agentAddress={fundAddress} />
            : <p style={{ fontSize: 11, color: "#363634", margin: 0, textAlign: "center" }}>Start agent first</p>
          }
        </div>
      </div>

      {/* Vaults overview */}
      <div style={{ background: "#0a0a08", border: "1px solid #1a1a18", borderRadius: 14, padding: "12px 16px" }}>
        <p style={{ fontSize: 9, color: "#363634", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>Vaults Managed</p>
        {[
          { id: "yoUSD",  chains: "Base · ETH · ARB" },
          { id: "yoETH",  chains: "Base · ETH" },
          { id: "yoBTC",  chains: "Base · ETH" },
          { id: "yoEUR",  chains: "Base · ETH" },
          { id: "yoGOLD", chains: "ETH only" },
          { id: "yoUSDT", chains: "ETH only" },
        ].map((v) => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #0d0d0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: VAULT_COLORS[v.id] ?? "#525252", opacity: 0.8 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#a0a0a0" }}>{v.id}</span>
            </div>
            <span style={{ fontSize: 9, color: "#363634" }}>{v.chains}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
