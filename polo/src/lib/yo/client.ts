import { createYoClient } from "@yo-protocol/core";
import { YO_CHAIN_ID } from "./vaults";

// Singleton Yo client for Base (chain 8453)
// partnerId 9999 = unattributed — get your own at https://x.com/yield
export function createBaseYoClient() {
  return createYoClient({
    chainId: YO_CHAIN_ID,
    partnerId: 9999,
  });
}
