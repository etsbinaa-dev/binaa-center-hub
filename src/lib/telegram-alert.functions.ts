import { createServerFn } from "@tanstack/react-start";

export type TelegramAlertKind =
  | "order_new"
  | "invoice_new"
  | "invoice_sent"
  | "delivery_start"
  | "delivery_done"
  | "low_stock"
  | "daily_payment"
  | "test";

const HEADER: Record<TelegramAlertKind, string> = {
  order_new: "🆕 طلب جديد",
  invoice_new: "🧾 فاتورة جديدة",
  invoice_sent: "✅ تم إرسال الفاتورة",
  delivery_start: "🚚 بدء التوصيل",
  delivery_done: "📦 تم التسليم",
  low_stock: "⚠️ مخزون منخفض",
  daily_payment: "💵 تحصيل يومي جديد",
  test: "🔔 اختبار الاتصال",
};

function getChatIds(): string[] {
  const a = process.env.TELEGRAM_CHAT_IDS ?? "";
  const b = process.env.TELEGRAM_CHAT_ID ?? "";
  return [a, b]
    .join(",")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatTimestamp(): string {
  try {
    return new Intl.DateTimeFormat("ar", {
      timeZone: "Africa/Nouakchott",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

export async function sendTelegram(text: string): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getChatIds();
  if (!token || chatIds.length === 0) {
    console.warn("[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID(S)");
    return { ok: false, sent: 0, errors: ["missing_config"] };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let sent = 0;
  const errors: string[] = [];
  await Promise.all(
    chatIds.map(async (chat_id) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id, text, parse_mode: "MarkdownV2", disable_web_page_preview: true }),
        });
        if (!res.ok) {
          const body = await res.text();
          errors.push(`${chat_id}: ${res.status} ${body}`);
        } else {
          sent += 1;
        }
      } catch (e: any) {
        errors.push(`${chat_id}: ${e?.message ?? String(e)}`);
      }
    }),
  );
  if (errors.length) console.error("[telegram] errors:", errors);
  return { ok: errors.length === 0, sent, errors };
}

export const sendTelegramAlert = createServerFn({ method: "POST" })
  .inputValidator((d: { kind: TelegramAlertKind; message: string }) => d)
  .handler(async ({ data }) => {
    const text = [HEADER[data.kind] ?? "🔔 إشعار", "", data.message, "", `🕒 ${formatTimestamp()}`].join("\n");
    return sendTelegram(text);
  });

export const sendTelegramRaw = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => d)
  .handler(async ({ data }) => sendTelegram(data.text));
