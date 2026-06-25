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

export function escapeMd(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// ─── إرسال للمجموعة فقط (TELEGRAM_CHAT_IDS) ─────────────────────────────
async function sendToGroup(text: string): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ids = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token || ids.length === 0) {
    console.warn("[telegram-group] missing config");
    return { ok: false, sent: 0, errors: ["missing_config"] };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let sent = 0;
  const errors: string[] = [];

  await Promise.all(
    ids.map(async (chat_id) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
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

  return { ok: errors.length === 0, sent, errors };
}

// ─── إرسال للمدير فقط (TELEGRAM_CHAT_ID) ────────────────────────────────
async function sendToAdmin(text: string): Promise<{ ok: boolean }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();

  if (!token || !chatId) {
    console.warn("[telegram-admin] missing config");
    return { ok: false };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// ─── للمجموعة (طلبات، استقبال، توصيل) ───────────────────────────────────
export async function sendTelegram(text: string): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  return sendToGroup(text);
}

// ─── للمدير فقط (تقرير يومي، مخزون، متابعة الدفع) ───────────────────────
export async function sendTelegramAdmin(text: string): Promise<{ ok: boolean }> {
  return sendToAdmin(text);
}

// ─── Server Functions ─────────────────────────────────────────────────────

export const sendTelegramAlert = createServerFn({ method: "POST" })
  .inputValidator((d: { kind: TelegramAlertKind; message: string }) => d)
  .handler(async ({ data }) => {
    const text = [HEADER[data.kind] ?? "🔔 إشعار", "", data.message, "", `🕒 ${formatTimestamp()}`].join("\n");
    return sendToGroup(text);
  });

export const sendTelegramRaw = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => d)
  .handler(async ({ data }) => sendToGroup(data.text));

export const sendTelegramAdminRaw = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => d)
  .handler(async ({ data }) => sendToAdmin(data.text));
