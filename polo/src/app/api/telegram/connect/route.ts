import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "";

// POST /api/telegram/connect — generate a verification token
export async function POST(req: Request) {
  try {
    const { eoaAddress } = await req.json();
    if (!eoaAddress) {
      return NextResponse.json({ error: "Missing eoaAddress" }, { status: 400 });
    }
    if (!BOT_USERNAME) {
      return NextResponse.json({ error: "Telegram bot not configured" }, { status: 503 });
    }

    const token = crypto.randomBytes(4).toString("hex"); // 8-char hex code
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.userSession.upsert({
      where: { eoaAddress: eoaAddress.toLowerCase() },
      update: { telegramToken: token, telegramTokenExpiry: expiry },
      create: {
        eoaAddress: eoaAddress.toLowerCase(),
        smartAccountAddress: "",
        sessionDetails: [],
        active: false,
        expiresAt: new Date(0),
        telegramToken: token,
        telegramTokenExpiry: expiry,
      },
    });

    const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;

    return NextResponse.json({ token, botUsername: BOT_USERNAME, deepLink });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
