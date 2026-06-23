import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram-alert.functions";

// Helpers
async function ensureAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
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

async function isKindEnabled(supabaseAdmin: any, kind: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("notification_settings")
      .select("enabled")
      .eq("kind", kind)
      .maybeSingle();
    if (error) {
      console.error("[followup:settings]", error);
      return true;
    }
    if (!data) return true;
    return data.enabled !== false;
  } catch (e) {
    console.error("[followup:settings]", e);
    return true;
  }
}

// --- Invoice amount ---
export const setInvoiceAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        invoice_id: z.string().uuid(),
        amount: z.number().nonnegative().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("invoices")
      .update({ amount: data.amount })
      .eq("id", data.invoice_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Apply payment (partial or full) ---
export const applyInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        invoice_id: z.string().uuid(),
        mode: z.enum(["partial", "full"]),
        amount: z.number().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: inv, error: ie } = await context.supabase
      .from("invoices")
      .select("amount, paid_amount")
      .eq("id", data.invoice_id)
      .maybeSingle();
    if (ie) throw new Error(ie.message);
    if (!inv) throw new Error("Invoice not found");
    const total = Number((inv as any).amount ?? 0);
    const currentPaid = Number((inv as any).paid_amount ?? 0);
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("لا يمكن تسجيل دفعة قبل تحديد المبلغ الأصلي للفاتورة");
    }
    let newPaid: number;
    if (data.mode === "full") {
      newPaid = total;
    } else {
      const add = Number(data.amount ?? 0);
      if (!Number.isFinite(add) || add <= 0) throw new Error("مبلغ غير صالح");
      newPaid = Math.min(total, currentPaid + add);
    }
    const remaining = Math.max(0, total - newPaid);
    const status = remaining <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    const update = {
      paid_amount: newPaid,
      payment_status: status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    };
    const { error } = await context.supabase
      .from("invoices")
      .update(update)
      .eq("id", data.invoice_id);
    if (error) throw new Error(error.message);
    return { ok: true, paid_amount: newPaid, remaining, payment_status: status };
  });

// --- Listing: grouped by customer_phone ---
export const listFollowupGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data: invoices, error } = await context.supabase
      .from("invoices")
      .select(
        "id, customer_name, customer_phone, invoice_number, amount, paid_amount, payment_status, paid_at, last_reminder_at, created_at, sent_at, status",
      )
      .eq("status", "sent")
      .neq("payment_status", "paid")
      .order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invoices: invoices ?? [] };
  });

// --- Scan & dispatch (reminders after 1 day, max 1 telegram per day per invoice) ---
export async function runFollowupScan(supabaseAdmin: any) {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 1 * 86400000).toISOString();
  const oneDayAgo = cutoff;

  // SENT, unpaid invoices, sent at least 1 day ago
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select(
      "id, customer_name, customer_phone, invoice_number, amount, paid_amount, payment_status, created_at, sent_at, last_reminder_at",
    )
    .eq("status", "sent")
    .neq("payment_status", "paid")
    .not("sent_at", "is", null)
    .lte("sent_at", cutoff);

  let sent = 0;
  for (const inv of invoices ?? []) {
    // skip if a telegram reminder was sent within last 24h
    if (inv.last_reminder_at && inv.last_reminder_at > oneDayAgo) continue;

    const amt = Number(inv.amount ?? 0);
    const paid = Number(inv.paid_amount ?? 0);
    const remaining = Math.max(0, amt - paid);

    const tgText = [
      "💰 تذكير حساب متأخر",
      "",
      `👤 ${inv.customer_name ?? "—"}`,
      `📞 ${inv.customer_phone ?? "—"}`,
      `🧾 فاتورة: ${inv.invoice_number ?? "—"}`,
      amt > 0 ? `💵 الإجمالي: ${amt.toLocaleString()}` : "",
      paid > 0 ? `✅ المدفوع: ${paid.toLocaleString()}` : "",
      `🔴 المتبقي: ${remaining.toLocaleString()} MRO`,
      `📅 أُرسلت: ${inv.sent_at ? new Date(inv.sent_at).toLocaleDateString("ar") : "—"}`,
      "",
      `🕒 ${fmtTime()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const enabled = await isKindEnabled(supabaseAdmin, "debt_reminder");
    const tg = enabled
      ? await sendTelegram(tgText)
      : { ok: false, sent: 0, errors: ["disabled"] };
    if (!enabled) console.info("[followup] telegram skipped (disabled): debt_reminder");

    if (tg.ok) {
      await supabaseAdmin
        .from("invoices")
        .update({ last_reminder_at: nowIso })
        .eq("id", inv.id);
      sent += 1;
    }
  }

  return { sent, scanned: (invoices ?? []).length };
}

export const runFollowupScanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runFollowupScan(supabaseAdmin);
  });
