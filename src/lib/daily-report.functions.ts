import { createServerFn } from "@tanstack/react-start";
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

const HOUSE_SIGN: Record<string, number> = {
  deposit: 1,
  withdraw: -1,
  expense: -1,
};

export async function runDailyReport(supabaseAdmin: any) {
  // Toggle gate
  const { data: settingsRow } = await supabaseAdmin
    .from("notification_settings")
    .select("enabled")
    .eq("kind", "daily_report")
    .maybeSingle();
  const enabled = !settingsRow || settingsRow.enabled !== false;
  if (!enabled) {
    return { ok: false, skipped: true };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();

  const count = (q: any) => q.then((r: any) => r.count ?? 0);

  const [
    activeOrders,
    unsentInvoices,
    activeDeliveries,
    receptionsToday,
    quantities,
    houseOps,
    tempPending,
    overdueAccounts,
    threshold,
  ] = await Promise.all([
    count(
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).neq("status", "archived"),
    ),
    count(
      supabaseAdmin.from("invoices").select("id", { count: "exact", head: true }).eq("status", "new"),
    ),
    count(
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("delivery_status", ["new", "in_progress"]),
    ),
    supabaseAdmin
      .from("receptions")
      .select("supplier, goods_type, quantity, unit")
      .eq("is_archived", false)
      .gte("created_at", iso),
    supabaseAdmin.from("quantities").select("label, quantity"),
    supabaseAdmin.from("house_cash_ops").select("op_type, amount"),
    count(
      supabaseAdmin
        .from("temp_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    count(
      supabaseAdmin
        .from("account_reminders")
        .select("id", { count: "exact", head: true })
        .neq("status", "paid"),
    ),
    supabaseAdmin.from("app_settings").select("critical_quantity").eq("id", 1).maybeSingle(),
  ]);

  const critQty = Number((threshold.data as any)?.critical_quantity ?? 5);
  const balance = (houseOps.data ?? []).reduce(
    (acc: number, r: any) => acc + (HOUSE_SIGN[r.op_type] ?? 0) * (Number(r.amount) || 0),
    0,
  );

  const lowOrCritical = (quantities.data ?? []).filter(
    (q: any) => (Number(q.quantity) || 0) <= Math.max(critQty, 50),
  );

  const receptionLines =
    (receptionsToday.data ?? []).length === 0
      ? ["—"]
      : (receptionsToday.data as any[]).map(
          (r) => `• ${r.supplier} — ${r.goods_type} (${r.quantity} ${r.unit})`,
        );

  const lowLines =
    lowOrCritical.length === 0
      ? ["—"]
      : lowOrCritical.map((q: any) => {
          const qty = Number(q.quantity) || 0;
          const tag = qty <= critQty ? "🔴 حرج" : "🟠 منخفض";
          return `• ${q.label}: ${qty} ${tag}`;
        });

  const fmtMoney = (n: number) =>
    n.toLocaleString("ar-DZ", { maximumFractionDigits: 2 }) + " MRO";

  const text = [
    "📊 التقرير اليومي — بِناء HUB",
    "",
    `📦 طلبات نشطة: ${activeOrders}`,
    `🧾 فواتير غير مرسلة: ${unsentInvoices}`,
    `🚚 توصيلات نشطة: ${activeDeliveries}`,
    `💵 رصيد كيص الدار: ${fmtMoney(balance)}`,
    `📝 قيود مؤقتة غير معالجة: ${tempPending}`,
    `⏰ حسابات متأخرة غير محصلة: ${overdueAccounts}`,
    "",
    "📥 استقبال البضاعة اليوم:",
    ...receptionLines,
    "",
    "⚠️ المخزون المنخفض/الحرج:",
    ...lowLines,
    "",
    `🕒 ${fmtTime()}`,
  ].join("\n");

  const tg = await sendTelegram(text);
  return { ok: tg.ok, sent: tg.sent };
}

export const runDailyReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runDailyReport(supabaseAdmin);
  });
