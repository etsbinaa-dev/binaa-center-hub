import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram-alert.functions";

export type DailyPaymentMethod = "bankily" | "seddad" | "cash" | "check" | "other";

const METHOD_LABEL: Record<DailyPaymentMethod, string> = {
  bankily: "Bankily",
  seddad: "Seddad",
  cash: "نقدًا",
  check: "شيك",
  other: "أخرى",
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

function formatAmount(n: number): string {
  try {
    return new Intl.NumberFormat("fr-FR").format(n);
  } catch {
    return String(n);
  }
}

export const notifyDailyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      customerName: string;
      amount: number;
      method: DailyPaymentMethod;
      userName: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: setting } = await supabase
      .from("notification_settings")
      .select("enabled")
      .eq("kind", "daily_payment")
      .maybeSingle();
    if (setting && setting.enabled === false) {
      return { ok: true, skipped: true as const };
    }
    const lines = [
      "💵 تحصيل يومي جديد",
      "",
      `👤 العميل: ${data.customerName}`,
      `💰 المبلغ: ${formatAmount(data.amount)}`,
      `💳 الوسيلة: ${METHOD_LABEL[data.method] ?? data.method}`,
      `🧑‍💼 المستخدم: ${data.userName}`,
      `🕒 ${formatTimestamp()}`,
    ];
    const res = await sendTelegram(lines.join("\n"));
    return { ok: res.ok, sent: res.sent };
  });
