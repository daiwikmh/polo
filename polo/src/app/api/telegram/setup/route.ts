import { NextResponse } from "next/server";
import { setWebhook } from "@/lib/telegram/bot";

// GET /api/telegram/setup?url=https://your-domain.com
// Registers the webhook with Telegram. Call once per deployment/domain change.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing ?url= param" }, { status: 400 });
  }

  const webhookUrl = `${url}/api/telegram/webhook`;

  try {
    await setWebhook(webhookUrl);
    return NextResponse.json({ ok: true, webhookUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
