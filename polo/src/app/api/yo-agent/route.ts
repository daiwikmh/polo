import { NextResponse } from "next/server";
import {
  getYoAgentState,
  startYoAgent,
  stopYoAgent,
  resetYoAgent,
  setYoMode,
} from "@/lib/yo/yoAgent";

export async function GET() {
  return NextResponse.json(getYoAgentState());
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
        startYoAgent({
          privateKey,
          pollIntervalMs: body.pollIntervalMs ?? Number(process.env.YO_POLL_INTERVAL_MS ?? 90_000),
          mode: body.mode ?? "SIMULATION",
        });
        return NextResponse.json({ ok: true, status: "started" });
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
