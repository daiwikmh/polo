import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyLinked } from "@/lib/telegram/notifications";
import { answerCallbackQuery } from "@/lib/telegram/bot";
import { handleDepositStart, handleRedeemStart, handleAmountSelected, executeTrade } from "@/lib/telegram/trade";

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

    // Handle callback queries (inline button taps)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = String(cb.message?.chat?.id);
      const messageId = cb.message?.message_id;
      const data = cb.data as string;

      await answerCallbackQuery(cb.id);

      if (data === "cancel") {
        const { editMessage } = await import("@/lib/telegram/bot");
        await editMessage(chatId, messageId, "Cancelled.");
        return NextResponse.json({ ok: true });
      }

      // deposit:vaultId:chainId
      if (data.startsWith("deposit:")) {
        const [, vaultId, chainIdStr] = data.split(":");
        await handleDepositStart(chatId, vaultId, Number(chainIdStr));
        return NextResponse.json({ ok: true });
      }

      // redeem:vaultId:chainId
      if (data.startsWith("redeem:")) {
        const [, vaultId, chainIdStr] = data.split(":");
        await handleRedeemStart(chatId, vaultId, Number(chainIdStr));
        return NextResponse.json({ ok: true });
      }

      // amt:action:vaultId:chainId:amount — amount selected, show confirm
      if (data.startsWith("amt:")) {
        const [, action, vaultId, chainIdStr, amount] = data.split(":");
        await handleAmountSelected(chatId, messageId, action, vaultId, Number(chainIdStr), amount);
        return NextResponse.json({ ok: true });
      }

      // exec:action:vaultId:chainId[:amount] — confirmed, execute trade
      if (data.startsWith("exec:")) {
        const parts = data.split(":");
        const [, action, vaultId, chainIdStr] = parts;
        const amount = parts[4]; // optional for redeem
        await executeTrade(chatId, messageId, action, vaultId, Number(chainIdStr), amount);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // Handle text messages
    const message = update?.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Handle plain /start (no token — bot already started, deep link didn't pass token)
    if (text === "/start") {
      const { sendMessage } = await import("@/lib/telegram/bot");
      await sendMessage(chatId, "Welcome to Polo.\n\nTo connect, go to the dashboard, click *Telegram Alerts*, then type the 8-character code shown here.");
      return NextResponse.json({ ok: true });
    }

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
        const { sendMessage } = await import("@/lib/telegram/bot");
        await sendMessage(chatId, "Link code expired or invalid. Generate a new one from the Polo dashboard.");
        return NextResponse.json({ ok: true });
      }

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

    // Handle plain text token (user types code directly or deep link resends token separately)
    if (/^[0-9a-f]{8}$/.test(text)) {
      const session = await prisma.userSession.findFirst({
        where: {
          telegramToken: text,
          telegramTokenExpiry: { gte: new Date() },
        },
      });

      if (!session) {
        const { sendMessage } = await import("@/lib/telegram/bot");
        await sendMessage(chatId, "Link code expired or invalid. Generate a new one from the Polo dashboard.");
        return NextResponse.json({ ok: true });
      }

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
