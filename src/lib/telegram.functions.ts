import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram-alert.functions";

type Kind = "created" | "invoiced" | "updated";

const HEADER: Record<Kind, string> = {
  created: "🆕 طلب جديد",
  invoiced: "✅ تم فوترة الطلب",
  updated: "✏️ تم تحديث الطلب",
};

function formatTimestamp(): string {
  try {
    return new Intl.DateTimeFormat("ar", {
      timeZone: "Asia/Riyadh",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

export const sendTelegramOrderNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: Kind; customerName: string; phone: string; details: string }) => d)
  .handler(async ({ data }) => {
    const text = [
      HEADER[data.kind],
      "",
      `👤 العميل: ${data.customerName}`,
      `📞 الهاتف: ${data.phone}`,
      `📦 الطلب: ${data.details}`,
      "",
      `🕒 ${formatTimestamp()}`,
    ].join("\n");
    return sendTelegram(text);
  });
