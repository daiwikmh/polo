"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { YieldProvider } from "@yo-protocol/react";
import { wagmiConfig } from "@/lib/shared/wagmi";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* partnerId 9999 = unattributed — get your own at https://x.com/yield */}
        <YieldProvider partnerId={9999} defaultSlippageBps={50}>
          {children}
        </YieldProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
