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

// --- Settings ---
export const getFollowupSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("accounts_followup_settings" as any)
      .select("threshold_amount, initial_delay_days, snooze_days")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        threshold_amount: 50000,
        initial_delay_days: 2,
        snooze_days: 3,
      }
    );
  });

export const updateFollowupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        threshold_amount: z.number().nonnegative(),
        initial_delay_days: z.number().int().min(1).max(60),
        snooze_days: z.number().int().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("accounts_followup_settings" as any)
      .upsert({ id: 1, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
    const update: Record<string, unknown> = {
      paid_amount: newPaid,
      payment_status: status,
    };
    if (status === "paid") update.paid_at = new Date().toISOString();
    else update.paid_at = null;
    const { error } = await context.supabase
      .from("invoices")
      .update(update)
      .eq("id", data.invoice_id);
    if (error) throw new Error(error.message);
    return { ok: true, paid_amount: newPaid, remaining, payment_status: status };
  });


// --- Listing ---
export const listMajorAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);

    const settings = await context.supabase
      .from("accounts_followup_settings" as any)
      .select("threshold_amount, initial_delay_days, snooze_days")
      .eq("id", 1)
      .maybeSingle();
    const threshold = Number(((settings.data as any)?.threshold_amount) ?? 50000);

    const { data: invoices, error } = await context.supabase
      .from("invoices")
      .select(
        "id, customer_name, customer_phone, invoice_number, amount, payment_status, paid_at, last_reminder_at, created_at, sent_at, status",
      )
      .eq("status", "sent")
      .gte("amount", threshold)
      .order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (invoices ?? []).map((i: any) => i.id);
    let reminders: any[] = [];
    if (ids.length) {
      const { data: r, error: re } = await context.supabase
        .from("account_reminders" as any)
        .select("*")
        .in("invoice_id", ids)
        .order("created_at", { ascending: false });
      if (re) throw new Error(re.message);
      reminders = r ?? [];
    }
    return { settings: settings.data, invoices: invoices ?? [], reminders };
  });

// --- Respond ---
export const respondReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        reminder_id: z.string().uuid(),
        response: z.enum(["paid", "not_paid", "snoozed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);

    const { data: rem, error: re } = await context.supabase
      .from("account_reminders" as any)
      .select("id, invoice_id")
      .eq("id", data.reminder_id)
      .maybeSingle();
    if (re) throw new Error(re.message);
    if (!rem) throw new Error("Reminder not found");

    const settings = await context.supabase
      .from("accounts_followup_settings" as any)
      .select("snooze_days")
      .eq("id", 1)
      .maybeSingle();
    const snoozeDays = Number(((settings.data as any)?.snooze_days) ?? 3);

    const now = new Date();
    const update: any = {
      status: data.response,
      responded_at: now.toISOString(),
      responded_by: context.userId,
    };
    if (data.response === "not_paid" || data.response === "snoozed") {
      const next = new Date(now.getTime() + snoozeDays * 86400000);
      update.next_remind_at = next.toISOString();
    } else {
      update.next_remind_at = null;
    }

    const { error: ue } = await context.supabase
      .from("account_reminders" as any)
      .update(update)
      .eq("id", data.reminder_id);
    if (ue) throw new Error(ue.message);

    if (data.response === "paid") {
      await context.supabase
        .from("invoices")
        .update({ payment_status: "paid", paid_at: now.toISOString() })
        .eq("id", (rem as any).invoice_id);
    }
    return { ok: true };
  });

// --- Scan & dispatch (used by both manual button and the cron public route) ---
export async function runFollowupScan(supabaseAdmin: any) {
  const { data: s } = await supabaseAdmin
    .from("accounts_followup_settings")
    .select("threshold_amount, initial_delay_days, snooze_days")
    .eq("id", 1)
    .maybeSingle();
  const threshold = Number(s?.threshold_amount ?? 50000);
  const initialDays = Number(s?.initial_delay_days ?? 2);

  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - initialDays * 86400000).toISOString();

  // 1. SENT invoices that need a FIRST reminder
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("id, customer_name, customer_phone, invoice_number, amount, created_at, sent_at")
    .gte("amount", threshold)
    .eq("payment_status", "unpaid")
    .eq("status", "sent")
    .not("sent_at", "is", null)
    .lte("sent_at", cutoff);

  const created: any[] = [];
  for (const inv of invoices ?? []) {
    // skip if an open reminder already exists
    const { data: existing } = await supabaseAdmin
      .from("account_reminders")
      .select("id")
      .eq("invoice_id", inv.id)
      .in("status", ["pending"])
      .limit(1);
    if (existing && existing.length > 0) continue;

    const msg = `Customer ${inv.customer_name} has a large invoice. Has he paid?`;
    const { data: ins } = await supabaseAdmin
      .from("account_reminders")
      .insert({ invoice_id: inv.id, status: "pending", message: msg, due_at: nowIso })
      .select("id")
      .single();

    await supabaseAdmin
      .from("invoices")
      .update({ last_reminder_at: nowIso })
      .eq("id", inv.id);

    const tgText = [
      "💰 متابعة حسابات",
      "",
      msg,
      `🧾 رقم الفاتورة: ${inv.invoice_number}`,
      inv.amount != null ? `💵 المبلغ: ${inv.amount}` : "",
      `📞 ${inv.customer_phone}`,
      "",
      `🕒 ${fmtTime()}`,
    ]
      .filter(Boolean)
      .join("\n");
    const enabled = await isKindEnabled(supabaseAdmin, "large_account");
    const tg = enabled
      ? await sendTelegram(tgText)
      : { ok: false, sent: 0, errors: ["disabled"] };
    if (!enabled) console.info("[followup] telegram skipped (disabled): large_account");
    if (tg.ok && ins?.id) {
      await supabaseAdmin
        .from("account_reminders")
        .update({ telegram_sent_at: nowIso })
        .eq("id", ins.id);
    }
    created.push(ins?.id);
  }

  // 2. Snoozed / not_paid reminders whose next_remind_at has passed -> re-open as new pending
  const { data: dueAgain } = await supabaseAdmin
    .from("account_reminders")
    .select("id, invoice_id")
    .in("status", ["snoozed", "not_paid"])
    .lte("next_remind_at", nowIso);

  for (const r of dueAgain ?? []) {
    // ensure invoice still unpaid
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("id, customer_name, customer_phone, invoice_number, amount, payment_status")
      .eq("id", r.invoice_id)
      .maybeSingle();
    if (!inv || inv.payment_status === "paid") continue;

    const msg = `Customer ${inv.customer_name} has a large invoice. Has he paid?`;
    const { data: ins } = await supabaseAdmin
      .from("account_reminders")
      .insert({ invoice_id: inv.id, status: "pending", message: msg, due_at: nowIso })
      .select("id")
      .single();

    // mark old as closed so we don't re-trigger
    await supabaseAdmin
      .from("account_reminders")
      .update({ next_remind_at: null })
      .eq("id", r.id);

    await supabaseAdmin
      .from("invoices")
      .update({ last_reminder_at: nowIso })
      .eq("id", inv.id);

    const tgText = [
      "🔁 تذكير حسابات",
      "",
      msg,
      `🧾 رقم الفاتورة: ${inv.invoice_number}`,
      inv.amount != null ? `💵 المبلغ: ${inv.amount}` : "",
      `📞 ${inv.customer_phone}`,
      "",
      `🕒 ${fmtTime()}`,
    ]
      .filter(Boolean)
      .join("\n");
    const enabled2 = await isKindEnabled(supabaseAdmin, "debt_reminder");
    const tg = enabled2
      ? await sendTelegram(tgText)
      : { ok: false, sent: 0, errors: ["disabled"] };
    if (!enabled2) console.info("[followup] telegram skipped (disabled): debt_reminder");
    if (tg.ok && ins?.id) {
      await supabaseAdmin
        .from("account_reminders")
        .update({ telegram_sent_at: nowIso })
        .eq("id", ins.id);
    }
    created.push(ins?.id);
  }

  return { created: created.length };
}

export const runFollowupScanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runFollowupScan(supabaseAdmin);
  });
