import { NextResponse } from "next/server";
import {
  getYoAgentState,
  startYoAgent,
  startYoAgentWithSession,
  stopYoAgent,
  resetYoAgent,
  setYoMode,
} from "@/lib/yo/yoAgent";
import { prisma } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getYoAgentState());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start": {
        // Check if starting with a user session (Biconomy smart account)
        const userAddress: string | undefined = body.userAddress;

        if (userAddress) {
          // Try session mode first — if user has an active Biconomy session
          const session = await prisma.userSession.findUnique({
            where: { eoaAddress: userAddress.toLowerCase() },
          });

          const hasActiveSession = session?.active && session.expiresAt > new Date();

          if (hasActiveSession) {
            // Expire check
            const agentSignerKey = process.env.PRIVATE_KEY;
            if (!agentSignerKey) {
              return NextResponse.json(
                { error: "No PRIVATE_KEY (agent signer) configured" },
                { status: 400 },
              );
            }

            startYoAgentWithSession({
              agentSignerKey,
              userSmartAccountAddress: session.smartAccountAddress,
              userEoa: session.eoaAddress,
              sessionDetails: session.sessionDetails as never[],
              pollIntervalMs: body.pollIntervalMs ?? Number(process.env.YO_POLL_INTERVAL_MS ?? 90_000),
              mode: body.mode ?? "SIMULATION",
            });

            return NextResponse.json({ ok: true, status: "started", executionMode: "session" });
          }

          // No active session — fall through to platform mode with userEoa
        }

        // Platform mode — use PRIVATE_KEY directly (demo/testing)
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
          return NextResponse.json(
            { error: "No PRIVATE_KEY configured in environment" },
            { status: 400 },
          );
        }
        startYoAgent({
          privateKey,
          pollIntervalMs: body.pollIntervalMs ?? Number(process.env.YO_POLL_INTERVAL_MS ?? 90_000),
          mode: body.mode ?? "SIMULATION",
          userEoa: userAddress?.toLowerCase(),
        });
        return NextResponse.json({ ok: true, status: "started", executionMode: "platform" });
      }

      case "stop":
        stopYoAgent();
        return NextResponse.json({ ok: true, status: "stopped" });

      case "reset":
        resetYoAgent();
        return NextResponse.json({ ok: true, status: "reset" });

      case "set-mode":
        setYoMode(body.mode ?? "SIMULATION");
        return NextResponse.json({ ok: true, mode: body.mode });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
