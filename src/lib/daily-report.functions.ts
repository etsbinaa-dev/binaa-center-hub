import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram-alert.functions";

async function sendTelegramToAdmin(text: string): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID");
    return { ok: false, sent: 0, errors: ["missing_config"] };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, sent: 0, errors: [`${chatId}: ${res.status} ${body}`] };
    }
    return { ok: true, sent: 1, errors: [] };
  } catch (e: any) {
    return { ok: false, sent: 0, errors: [e?.message ?? String(e)] };
  }
}

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

// Returns current time in Africa/Nouakchott as { hour, minute, dateKey }
function nouakchottNow(): { hour: number; minute: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nouakchott",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

const HOUSE_SIGN: Record<string, number> = {
  central_to_house: 1,
  add_cash: 1,
  house_to_bank: -1,
  house_to_central: -1,
  withdraw_cash: -1,
};

type RunOptions = { force?: boolean };

export async function runDailyReport(supabaseAdmin: any, opts: RunOptions = {}) {
  // Toggle gate
  const { data: settingsRow } = await supabaseAdmin
    .from("notification_settings")
    .select("enabled")
    .eq("kind", "daily_report")
    .maybeSingle();
  const enabled = !settingsRow || settingsRow.enabled !== false;
  if (!enabled && !opts.force) {
    return { ok: false, skipped: true, reason: "disabled" };
  }

  // Read scheduled time + last-sent date
  const { data: appRow } = await supabaseAdmin
    .from("app_settings")
    .select("daily_report_time, daily_report_last_sent_date")
    .eq("id", 1)
    .maybeSingle();

  const timeStr: string = (appRow as any)?.daily_report_time ?? "21:00:00";
  const [thStr, tmStr] = timeStr.split(":");
  const targetHour = parseInt(thStr, 10);
  const targetMin = parseInt(tmStr, 10);
  const now = nouakchottNow();

  if (!opts.force) {
    // Only fire if current time is within the 10-minute window starting at target
    const nowMinutes = now.hour * 60 + now.minute;
    const targetMinutes = targetHour * 60 + targetMin;
    const diff = nowMinutes - targetMinutes;
    if (diff < 0 || diff >= 10) {
      return { ok: false, skipped: true, reason: "not_time" };
    }
    if ((appRow as any)?.daily_report_last_sent_date === now.dateKey) {
      return { ok: false, skipped: true, reason: "already_sent_today" };
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();

  const count = (q: any) => q.then((r: any) => r.count ?? 0);

  const [
    activeOrdersCount,
    unsentInvoicesList,
    activeDeliveriesList,
    receptionsToday,
    quantities,
    houseOps,
    tempPendingList,
    overdueAccountsList,
    threshold,
  ] = await Promise.all([
    count(
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).neq("status", "archived"),
    ),
    supabaseAdmin
      .from("invoices")
      .select("customer_name")
      .eq("status", "new")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("orders")
      .select("details, customer:customers(name)")
      .in("delivery_status", ["new", "in_progress"])
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("receptions")
      .select("supplier, goods_type, quantity, unit")
      .eq("is_archived", false)
      .gte("created_at", iso),
    supabaseAdmin.from("quantities").select("label, quantity"),
    supabaseAdmin.from("house_cash_ops").select("op_type, amount"),
    supabaseAdmin
      .from("temp_entries")
      .select("kind, amount, description")
      .neq("status", "done")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("account_reminders")
      .select("amount, paid_amount, status, invoice:invoices(customer_name, amount, amount_manual, paid_amount)"),
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
  // Sort: critical (🔴) first then low (🟠); within each group ascending by quantity
  lowOrCritical.sort((a: any, b: any) => {
    const qa = Number(a.quantity) || 0;
    const qb = Number(b.quantity) || 0;
    const ga = qa <= critQty ? 0 : 1;
    const gb = qb <= critQty ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return qa - qb;
  });

  const fmtMoney = (n: number) =>
    n.toLocaleString("ar-DZ", { maximumFractionDigits: 2 }) + " MRO";

  const unsentInvoices = (unsentInvoicesList.data ?? []) as any[];
  const activeDeliveries = (activeDeliveriesList.data ?? []) as any[];
  const overdueAccountsRaw = (overdueAccountsList.data ?? []) as any[];
  const overdueAccounts = overdueAccountsRaw.filter((r: any) => r.status !== "paid");
  const tempPendingRows = (tempPendingList.data ?? []) as any[];

  const deliveryLines =
    activeDeliveries.length === 0
      ? ["—"]
      : activeDeliveries.map((o) => {
          const name = o.customer?.name ?? "—";
          const details = (o.details ?? "").toString().trim().replace(/\s+/g, " ");
          const short = details.length > 120 ? details.slice(0, 120) + "…" : details || "—";
          return `• ${name} — ${short}`;
        });

  const invoiceLines =
    unsentInvoices.length === 0
      ? ["—"]
      : unsentInvoices.map((i) => `• ${i.customer_name ?? "—"}`);

  const overdueLines =
    overdueAccounts.length === 0
      ? ["—"]
      : overdueAccounts.map((r) => {
          const inv = r.invoice ?? {};
          const total = Number(inv.amount_manual ?? inv.amount ?? r.amount ?? 0);
          const paid = Number(inv.paid_amount ?? r.paid_amount ?? 0);
          const remaining = Math.max(total - paid, 0);
          return `• ${inv.customer_name ?? "—"}: ${fmtMoney(remaining)}`;
        });

  const receptionLines =
    (receptionsToday.data ?? []).length === 0
      ? ["—"]
      : (receptionsToday.data as any[]).map(
          (r) => `• ${r.supplier} — ${r.goods_type} (${r.quantity} ${r.unit})`,
        );

  const tempLines =
    tempPendingRows.length === 0
      ? ["—"]
      : tempPendingRows.map((t: any) => {
          const kind = t.kind === "income" ? "دخل" : t.kind === "expense" ? "خرج" : (t.kind ?? "—");
          const desc = (t.description ?? "").toString().trim() || "—";
          return `• ${kind} — ${fmtMoney(Number(t.amount) || 0)} — ${desc}`;
        });

  const lowLines =
    lowOrCritical.length === 0
      ? ["—"]
      : lowOrCritical.map((q: any) => {
          const qty = Number(q.quantity) || 0;
          const tag = qty <= critQty ? "🔴" : "🟠";
          return `• ${q.label}: ${qty} ${tag}`;
        });

  const text = [
    "📊 بِناء HUB — تقرير يومي",
    "",
    `📦 طلبات نشطة: ${activeOrdersCount}`,
    "",
    `🚚 توصيلات (${activeDeliveries.length}):`,
    ...deliveryLines,
    "",
    `🧾 فواتير غير مرسلة (${unsentInvoices.length}):`,
    ...invoiceLines,
    "",
    `💵 كيص الدار: ${fmtMoney(balance)}`,
    "",
    `📝 قيود غير معالجة (${tempPendingRows.length}):`,
    ...tempLines,
    "",
    `⏰ حسابات متأخرة (${overdueAccounts.length}):`,
    ...overdueLines,
    "",
    "📥 استقبال اليوم:",
    ...receptionLines,
    "",
    "⚠️ مخزون منخفض/حرج:",
    ...lowLines,
    "",
    `🕒 ${fmtTime()}`,
  ].join("\n");

  void sendTelegram;
  const tg = await sendTelegramToAdmin(text);

  if (tg.ok && !opts.force) {
    await supabaseAdmin
      .from("app_settings")
      .update({ daily_report_last_sent_date: now.dateKey })
      .eq("id", 1);
  }

  return { ok: tg.ok, sent: tg.sent };
}

export const runDailyReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runDailyReport(supabaseAdmin, { force: true });
  });
