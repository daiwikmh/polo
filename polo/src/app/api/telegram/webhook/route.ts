import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyLinked } from "@/lib/telegram/notifications";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

// POST /api/telegram/webhook — incoming Telegram bot updates
export async function POST(req: Request) {
  // Validate secret header
  if (WEBHOOK_SECRET) {
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update = await req.json();
    const message = update?.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Handle /start TOKEN
    if (text.startsWith("/start ")) {
      const token = text.slice(7).trim();
      if (!token) return NextResponse.json({ ok: true });

      const session = await prisma.userSession.findFirst({
        where: {
          telegramToken: token,
          telegramTokenExpiry: { gte: new Date() },
        },
      });

      if (!session) {
        // Token expired or invalid — import bot inline to send error
        const { sendMessage } = await import("@/lib/telegram/bot");
        await sendMessage(chatId, "Link code expired or invalid. Generate a new one from the Polo dashboard.");
        return NextResponse.json({ ok: true });
      }

      // Link telegram
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          telegramChatId: chatId,
          telegramToken: null,
          telegramTokenExpiry: null,
          telegramLinkedAt: new Date(),
        },
      });

      await notifyLinked(chatId);
      return NextResponse.json({ ok: true });
    }

    // Handle /stop — unlink
    if (text === "/stop") {
      await prisma.userSession.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null, telegramLinkedAt: null },
      });
      const { sendMessage } = await import("@/lib/telegram/bot");
      await sendMessage(chatId, "Telegram disconnected from Polo. You will no longer receive alerts.");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true }); // always 200 to Telegram
  }
}
