import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { formatThaiDateTime } from "../utils/date.js";

export async function sendTelegramMessage(message: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML"
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    logger.error("telegram", "Failed to send message", {
      status: response.status,
      responseText
    });
    throw new Error("Telegram message delivery failed");
  }

  logger.info("telegram", "Message sent successfully");
}

export async function sendTestTelegramMessage(): Promise<void> {
  await sendTelegramMessage(
    [
      "🧪 <b>ทดสอบการส่ง Telegram</b>",
      "ระบบสามารถเชื่อมต่อ Telegram Bot API ได้ปกติ",
      `เวลาส่ง: ${formatThaiDateTime(new Date(), env.CRON_TIMEZONE)}`
    ].join("\n")
  );
}
