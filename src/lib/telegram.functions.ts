import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Kind = "created" | "invoiced" | "updated";

const HEADER: Record<Kind, string> = {
  created: "🔔 طلب جديد",
  invoiced: "✅ تم فوترة الطلب",
  updated: "✏️ تم تحديث الطلب",
};

export const sendTelegramOrderNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: Kind; customerName: string; phone: string; details: string }) => d)
  .handler(async ({ data }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const idsRaw = process.env.TELEGRAM_CHAT_IDS;
    if (!token || !idsRaw) {
      console.warn("[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_IDS");
      return { ok: false, sent: 0, reason: "missing_config" as const };
    }
    const chatIds = idsRaw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const text = [
      HEADER[data.kind],
      "",
      `👤 العميل: ${data.customerName}`,
      `📞 الهاتف: ${data.phone}`,
      `📦 الطلب: ${data.details}`,
    ].join("\n");

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let sent = 0;
    const errors: string[] = [];
    await Promise.all(
      chatIds.map(async (chat_id) => {
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
    if (errors.length) console.error("[telegram] errors:", errors);
    return { ok: true, sent, errors };
  });
