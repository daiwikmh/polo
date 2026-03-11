// Yo Protocol vault registry for Base (chain 8453)
// Source: https://docs.yo.xyz / yo-protocol-cli SKILL.md

export const YO_CHAIN_ID = 8453 as const;

export const YO_GATEWAY = "0xF1EeE0957267b1A474323Ff9CfF7719E964969FA" as const;

export const YO_VAULTS = [
  {
    id: "yoUSD",
    name: "yoUSD",
    address: "0x0000000f2eb9f69274678c76222b35eec7588a65" as `0x${string}`,
    underlying: "USDC",
    decimals: 6,
    color: "#00FF8B",
    underlyingAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`, // USDC on Base
  },
  {
    id: "yoETH",
    name: "yoETH",
    address: "0x3a43aec53490cb9fa922847385d82fe25d0e9de7" as `0x${string}`,
    underlying: "WETH",
    decimals: 18,
    color: "#2B2C2A",
    underlyingAddress: "0x4200000000000000000000000000000000000006" as `0x${string}`, // WETH on Base
  },
  {
    id: "yoBTC",
    name: "yoBTC",
    address: "0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc" as `0x${string}`,
    underlying: "cbBTC",
    decimals: 8,
    color: "#FFAF4F",
    underlyingAddress: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as `0x${string}`, // cbBTC on Base
  },
  {
    id: "yoEUR",
    name: "yoEUR",
    address: "0x50c749ae210d3977adc824ae11f3c7fd10c871e9" as `0x${string}`,
    underlying: "EURC",
    decimals: 6,
    color: "#4E6FFF",
    underlyingAddress: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as `0x${string}`, // EURC on Base
  },
] as const;

export type YoVaultId = (typeof YO_VAULTS)[number]["id"];

export function getVaultConfig(id: YoVaultId) {
  return YO_VAULTS.find((v) => v.id === id)!;
}

export function formatTvl(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatYield(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}
