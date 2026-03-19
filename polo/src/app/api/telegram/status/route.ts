import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/telegram/bot";

// GET /api/telegram/status?address=0x...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const session = await prisma.userSession.findUnique({
    where: { eoaAddress: address.toLowerCase() },
    select: { telegramChatId: true, telegramLinkedAt: true, telegramTradeEnabled: true },
  });

  return NextResponse.json({
    linked: !!session?.telegramChatId,
    linkedAt: session?.telegramLinkedAt?.toISOString() ?? null,
    tradeEnabled: session?.telegramTradeEnabled ?? false,
  });
}

// PATCH /api/telegram/status — toggle trade enabled
export async function PATCH(req: Request) {
  try {
    const { eoaAddress, tradeEnabled } = await req.json();
    if (!eoaAddress || typeof tradeEnabled !== "boolean") {
      return NextResponse.json({ error: "Missing eoaAddress or tradeEnabled" }, { status: 400 });
    }

    const session = await prisma.userSession.update({
      where: { eoaAddress: eoaAddress.toLowerCase() },
      data: { telegramTradeEnabled: tradeEnabled },
    });

    // DM the user about the toggle
    if (session.telegramChatId) {
      const msg = tradeEnabled
        ? "*Polo*\nTelegram trading is now *enabled*. You will see Deposit/Redeem buttons on vault updates. Tap them to trade directly from here."
        : "*Polo*\nTelegram trading is now *disabled*. You will still receive alerts but trade buttons are turned off.";
      await sendMessage(session.telegramChatId, msg);
    }

    return NextResponse.json({ ok: true, tradeEnabled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
