import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/telegram/disconnect — unlink Telegram
export async function POST(req: Request) {
  try {
    const { eoaAddress } = await req.json();
    if (!eoaAddress) {
      return NextResponse.json({ error: "Missing eoaAddress" }, { status: 400 });
    }

    await prisma.userSession.update({
      where: { eoaAddress: eoaAddress.toLowerCase() },
      data: {
        telegramChatId: null,
        telegramToken: null,
        telegramTokenExpiry: null,
        telegramLinkedAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
