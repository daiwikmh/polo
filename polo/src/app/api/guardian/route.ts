import { NextResponse } from "next/server";
import {
  getGuardianAgentState,
  startGuardianAgent,
  stopGuardianAgent,
  resetGuardianAgent,
  setGuardianMode,
} from "@/lib/guardian/agent";

export async function GET() {
  return NextResponse.json(getGuardianAgentState());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start": {
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
          return NextResponse.json(
            { error: "No PRIVATE_KEY configured in environment" },
            { status: 400 }
          );
        }
        startGuardianAgent({
          privateKey,
          pollIntervalMs: body.pollIntervalMs ?? Number(process.env.GUARDIAN_POLL_INTERVAL_MS ?? 120_000),
          mode: body.mode ?? "SIMULATION",
        });
        return NextResponse.json({ ok: true, status: "started" });
      }

      case "stop":
        stopGuardianAgent();
        return NextResponse.json({ ok: true, status: "stopped" });

      case "reset":
        resetGuardianAgent();
        return NextResponse.json({ ok: true, status: "reset" });

      case "set-mode":
        setGuardianMode(body.mode ?? "SIMULATION");
        return NextResponse.json({ ok: true, mode: body.mode });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
