import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/telegram/status?address=0x...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const session = await prisma.userSession.findUnique({
    where: { eoaAddress: address.toLowerCase() },
    select: { telegramChatId: true, telegramLinkedAt: true },
  });

  return NextResponse.json({
    linked: !!session?.telegramChatId,
    linkedAt: session?.telegramLinkedAt?.toISOString() ?? null,
  });
}
