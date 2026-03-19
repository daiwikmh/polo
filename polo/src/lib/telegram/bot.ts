// Thin Telegram Bot API client — no dependencies, just fetch
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

export async function setWebhook(url: string) {
  if (!BOT_TOKEN) return;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const res = await fetch(`${API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message"],
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
