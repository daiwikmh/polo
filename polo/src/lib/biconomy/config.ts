import { base } from "viem/chains";
import type { Address } from "viem";

// ─── YO Protocol Constants ──────────────────────────────────────────────────
export const YO_GATEWAY: Address = "0xF1EeE0957267b1A474323Ff9CfF7719E964969FA";

// YO Vault addresses on Base
export const YO_VAULTS = {
  yoUSD: "0x0000000f2eb9f69274678c76222b35eec7588a65" as Address,
  yoETH: "0x3a43aec53490cb9fa922847385d82fe25d0e9de7" as Address,
  yoBTC: "0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc" as Address,
  yoEUR: "0x50c749ae210d3977adc824ae11f3c7fd10c871e9" as Address,
} as const;

// Underlying tokens on Base (for approve() session permissions)
export const BASE_TOKENS = {
  USDC:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  WETH:  "0x4200000000000000000000000000000000000006" as Address,
  cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as Address,
  EURC:  "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as Address,
} as const;

// Chain config for Biconomy Nexus
export const NEXUS_CHAIN = base;
export const NEXUS_CHAIN_ID = base.id; // 8453

// Session key validity duration (24 hours)
export const SESSION_DURATION_SECONDS = 60 * 60 * 24;

// Fee token for MEE gas payments
export const FEE_TOKEN = BASE_TOKENS.USDC;
export const FEE_TOKEN_CHAIN_ID = base.id;

// Max gas payment in USDC (20 USDC)
export const MAX_GAS_PAYMENT = 20_000_000n; // 20 USDC (6 decimals)
