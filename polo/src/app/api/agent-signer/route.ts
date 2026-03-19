import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";

// Returns the agent signer's public address (derived from PRIVATE_KEY)
// This is safe to expose — it's the public address users delegate permissions to
export async function GET() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    return NextResponse.json({ address: null, error: "Agent signer not configured" }, { status: 500 });
  }

  const norm = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(norm as `0x${string}`);

  return NextResponse.json({ address: account.address });
}
