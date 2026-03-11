"use client";

import { useVaults, useVaultState, useUserPosition } from "@yo-protocol/react";
import { YO_VAULTS, type YoVaultId } from "@/lib/yo/vaults";

const YO_BASE_IDS: string[] = YO_VAULTS.map((v) => v.id);

// All four Base vaults from the REST API
export function useAllYoVaults() {
  const { vaults, isLoading, isError } = useVaults();

  const baseVaults = vaults.filter(
    (v) => v.chain.id === 8453 && YO_BASE_IDS.includes(v.id)
  );

  const totalTvl = baseVaults.reduce((acc, v) => acc + Number(v.tvl?.raw ?? 0), 0);

  const bestYield = baseVaults.reduce<{ id: string; apy: number } | null>((best, v) => {
    const apy = Number(v.yield?.["7d"] ?? 0);
    if (!best || apy > best.apy) return { id: v.id, apy };
    return best;
  }, null);

  return { vaults: baseVaults, isLoading, isError, totalTvl, bestYield };
}

// Single vault on-chain state
export function useYoVaultState(id: YoVaultId) {
  return useVaultState(id);
}

// User position for a single vault (auto-uses connected wallet)
export function useYoUserPosition(id: YoVaultId) {
  return useUserPosition(id);
}
