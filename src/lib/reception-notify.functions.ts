import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram-alert.functions";

function fmtTime(): string {
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

export const notifyReceptionCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        supplier: z.string(),
        goods_type: z.string(),
        quantity: z.number(),
        unit: z.string(),
        user_name: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Check setting toggle
    const { data: row } = await context.supabase
      .from("notification_settings")
      .select("enabled")
      .eq("kind", "reception_new")
      .maybeSingle();
    const enabled = !row || (row as any).enabled !== false;
    if (!enabled) return { ok: false, skipped: true };

    const text = [
      "📥 استقبال بضاعة جديدة",
      "",
      `🏭 المورد: ${data.supplier}`,
      `📦 النوع: ${data.goods_type}`,
      `⚖️ الكمية: ${data.quantity} ${data.unit}`,
      `🧑‍💼 المستخدم: ${data.user_name}`,
      "",
      `🕒 ${fmtTime()}`,
    ].join("\n");
    return sendTelegram(text);
  });
