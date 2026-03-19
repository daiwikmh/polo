// LI.FI bridge for cross-chain token transfers in YO Agent
//
// Ported from adios/src/lib/yield/yieldBridge.ts, generalized for all YO vault
// underlying tokens (USDC, WETH, cbBTC, EURC, XAUt, USDT).
//
// Quote + execution flow (LI.FI SDK v3):
//   getQuote(params)          → LiFiStep (transactionRequest populated)
//   convertQuoteToRoute(step) → Route
//   executeRoute(route, hooks)→ execute on-chain

import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, arbitrum } from "viem/chains";
import { createConfig, EVM, getQuote, executeRoute, convertQuoteToRoute } from "@lifi/sdk";
import type { LogEntry } from "@/types";

// ─── Chain config ────────────────────────────────────────────────────────────
const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
};

const RPC: Record<number, string> = {
  8453: process.env.BASE_RPC_URL ?? "https://base-mainnet.g.alchemy.com/v2/t7Oxw5b_OpDL6yQVWN70ZjxO6hTCaZeW",
  1: process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com",
  42161: process.env.ARB_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/v2/t7Oxw5b_OpDL6yQVWN70ZjxO6hTCaZeW",
};

// Stablecoins get tighter slippage
const STABLECOINS = new Set(["USDC", "EURC", "USDT"]);

// Minimal ERC20 ABI for dry-run simulation
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── LiFi SDK init ──────────────────────────────────────────────────────────
let configuredKey: string | null = null;
let configuredChainId: number | null = null;

function initLiFi(privateKey: string, sourceChainId: number) {
  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (configuredKey === normalizedKey && configuredChainId === sourceChainId) return;

  const account = privateKeyToAccount(normalizedKey as `0x${string}`);
  const sourceChain = CHAIN_MAP[sourceChainId];
  if (!sourceChain) throw new Error(`initLiFi: unsupported chain ${sourceChainId}`);

  createConfig({
    integrator: process.env.LIFI_INTEGRATOR || "polo",
    providers: [
      EVM({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getWalletClient: (async () =>
          createWalletClient({
            account,
            chain: sourceChain,
            transport: http(RPC[sourceChainId]),
          })) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        switchChain: (async (targetChainId: number) => {
          const targetChain = CHAIN_MAP[targetChainId];
          if (!targetChain) throw new Error(`LI.FI switchChain: unsupported chain ${targetChainId}`);
          return createWalletClient({
            account,
            chain: targetChain,
            transport: http(RPC[targetChainId] ?? RPC[8453]),
          });
        }) as any,
      }),
    ],
  });

  configuredKey = normalizedKey;
  configuredChainId = sourceChainId;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface BridgeRoute {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  estimatedOutput: string;
  bridgeUsed: string;
  executionTime: number;
}

export interface BridgeQuote {
  estimatedOutput: string;
  bridgeName: string;
  estimatedTime: number;
  bridgeCost: number; // in token units (human-readable)
}

// ─── YoBridge class ──────────────────────────────────────────────────────────
export class YoBridge {
  private privateKey: string;
  private address: `0x${string}`;
  private onLog: (log: Omit<LogEntry, "id">) => void;

  constructor(
    privateKey: string,
    address: string,
    onLog?: (log: Omit<LogEntry, "id">) => void
  ) {
    this.privateKey = privateKey;
    this.address = address as `0x${string}`;
    this.onLog = onLog ?? (() => {});
  }

  private log(level: LogEntry["level"], message: string) {
    this.onLog({ timestamp: Date.now(), level, message });
  }

  private publicClient(chainId: number): PublicClient {
    const chain = CHAIN_MAP[chainId];
    if (!chain) throw new Error(`No public client for chain ${chainId}`);
    return createPublicClient({
      chain,
      transport: http(RPC[chainId]),
    }) as PublicClient;
  }

  private slippage(symbol: string): number {
    return STABLECOINS.has(symbol) ? 0.005 : 0.01; // 0.5% stables, 1% volatile
  }

  /**
   * Lightweight quote — getQuote only, no eth_call.
   * Use before LLM decision to get real bridge cost.
   */
  async fetchQuoteCost(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amount: bigint,
    decimals: number,
    symbol: string
  ): Promise<BridgeQuote> {
    initLiFi(this.privateKey, fromChainId);

    const step = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken,
      toToken,
      fromAmount: amount.toString(),
      fromAddress: this.address,
      integrator: process.env.LIFI_INTEGRATOR ?? "polo",
      slippage: this.slippage(symbol),
    });

    const estimatedOutput = step.estimate?.toAmount ?? "0";
    const bridgeName = step.toolDetails?.name ?? "aggregated";
    const estimatedTime = step.estimate?.executionDuration ?? 60;
    const bridgeCost = (Number(amount) - Number(estimatedOutput)) / 10 ** decimals;

    return { estimatedOutput, bridgeName, estimatedTime, bridgeCost };
  }

  /**
   * Full dry-run — getQuote + eth_call simulation of the bridge tx.
   * Use in SIMULATION mode for validation without real execution.
   */
  async getDryRunQuote(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amount: bigint,
    decimals: number,
    symbol: string
  ): Promise<BridgeQuote> {
    initLiFi(this.privateKey, fromChainId);

    const divisor = 10 ** decimals;
    this.log(
      "INFO",
      `[DRY RUN] Quoting LI.FI: ${CHAIN_NAMES[fromChainId]} → ${CHAIN_NAMES[toChainId]} | ${(Number(amount) / divisor).toFixed(4)} ${symbol}`
    );

    const step = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken,
      toToken,
      fromAmount: amount.toString(),
      fromAddress: this.address,
      integrator: process.env.LIFI_INTEGRATOR ?? "polo",
      slippage: this.slippage(symbol),
    });

    const bridgeName = step.toolDetails?.name ?? "aggregated";
    const estimatedOutput = step.estimate?.toAmount ?? "0";
    const estimatedTime = step.estimate?.executionDuration ?? 60;
    const bridgeCost = (Number(amount) - Number(estimatedOutput)) / divisor;

    this.log(
      "INFO",
      `[DRY RUN] Route via ${bridgeName} | est. out: ${(Number(estimatedOutput) / divisor).toFixed(4)} ${symbol} | fee: ${bridgeCost.toFixed(4)} ${symbol}`
    );

    // Simulate approval + bridge tx via eth_call
    const txReq = step.transactionRequest;
    if (txReq?.to && txReq?.data) {
      const client = this.publicClient(fromChainId);

      try {
        await client.simulateContract({
          address: fromToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [txReq.to as `0x${string}`, amount],
          account: this.address,
        });
        this.log("SUCCESS", `[DRY RUN] Approval simulation passed`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log("WARN", `[DRY RUN] Approval sim note: ${msg.slice(0, 80)}`);
      }

      try {
        await client.call({
          account: this.address,
          to: txReq.to as `0x${string}`,
          data: txReq.data as `0x${string}`,
          value: txReq.value ? BigInt(txReq.value.toString()) : 0n,
        });
        this.log("SUCCESS", `[DRY RUN] Bridge tx simulation passed`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log(
          "WARN",
          `[DRY RUN] Bridge sim revert (expected — approval-gated): ${msg.slice(0, 100)}`
        );
      }
    } else {
      this.log("WARN", `[DRY RUN] Quote returned no transactionRequest — skipping eth_call`);
    }

    return { estimatedOutput, bridgeName, estimatedTime, bridgeCost };
  }

  /**
   * Live bridge — getQuote → convertQuoteToRoute → executeRoute.
   * LiFi SDK handles approvals automatically.
   */
  async executeBridge(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amount: bigint,
    decimals: number,
    symbol: string
  ): Promise<BridgeRoute> {
    initLiFi(this.privateKey, fromChainId);

    const divisor = 10 ** decimals;
    this.log(
      "INFO",
      `Bridging ${(Number(amount) / divisor).toFixed(4)} ${symbol}: ${CHAIN_NAMES[fromChainId]} → ${CHAIN_NAMES[toChainId]} via LI.FI`
    );

    const step = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken,
      toToken,
      fromAmount: amount.toString(),
      fromAddress: this.address,
      integrator: process.env.LIFI_INTEGRATOR ?? "polo",
      slippage: this.slippage(symbol),
    });

    const bridgeName = step.toolDetails?.name ?? "aggregated";
    const estimatedOutput = step.estimate?.toAmount ?? "0";

    if (!step.transactionRequest?.to) {
      throw new Error(`LI.FI quote returned no transactionRequest — aborting bridge`);
    }

    this.log(
      "SUCCESS",
      `LI.FI quote via ${bridgeName} — est. out: ${(Number(estimatedOutput) / divisor).toFixed(4)} ${symbol} | min: ${(Number(step.estimate?.toAmountMin ?? "0") / divisor).toFixed(4)} ${symbol}`
    );

    const route = convertQuoteToRoute(step);
    const start = Date.now();

    await executeRoute(route, {
      updateRouteHook: (updated) => {
        const s = updated.steps?.[0];
        if (s?.execution?.status) {
          this.log("INFO", `Bridge: ${s.execution.status}`);
        }
      },
    });

    const elapsed = Date.now() - start;
    this.log("SUCCESS", `Bridge complete — ${elapsed}ms`);

    return {
      fromChainId,
      toChainId,
      fromToken,
      toToken,
      fromAmount: amount.toString(),
      estimatedOutput,
      bridgeUsed: bridgeName,
      executionTime: elapsed,
    };
  }
}
