// Thin Telegram Bot API client — no dependencies, just fetch
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

type InlineButton = { text: string; callback_data: string };

export async function sendMessage(chatId: string, text: string) {
  if (!BOT_TOKEN) return;
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram sendMessage failed: ${err}`);
  }
}

export async function sendMessageWithButtons(
  chatId: string,
  text: string,
  buttons: InlineButton[][],
) {
  if (!BOT_TOKEN) return;
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttons },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram sendMessageWithButtons failed: ${err}`);
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!BOT_TOKEN) return;
  await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function editMessage(chatId: string, messageId: number, text: string, buttons?: InlineButton[][]) {
  if (!BOT_TOKEN) return;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  await fetch(`${API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function setWebhook(url: string) {
  if (!BOT_TOKEN) return;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const res = await fetch(`${API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram setWebhook failed: ${err}`);
  }
}

export function isBotConfigured(): boolean {
  return BOT_TOKEN.length > 0;
}
