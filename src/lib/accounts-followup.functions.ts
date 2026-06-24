import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegram } from "@/lib/telegram-alert.functions";

// ---------- Types ----------
export type ClientInvoice = {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  payment_status: "unpaid" | "partial" | "paid";
  sent_at: string | null;
  last_reminder_at: string | null;
  is_overdue: boolean;
};

export type ClientGroup = {
  phone: string;
  name: string;
  current_balance: number;
  invoices: ClientInvoice[];
  has_overdue: boolean;
  oldest_unpaid_sent_at: string | null;
};

// ---------- Helpers ----------
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
    if (error) return true;
    if (!data) return true;
    return data.enabled !== false;
  } catch {
    return true;
  }
}

function normalisePhone(p: string | null | undefined): string {
  return (p || "").replace(/[^\d]/g, "");
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

// ---------- Invoice amount ----------
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

// ---------- Apply payment ----------
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

// ---------- Upsert customer balance ----------
export const upsertCustomerBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().min(1),
        name: z.string().optional().default(""),
        initial_balance: z.number().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const phone = normalisePhone(data.phone);
    if (!phone) throw new Error("رقم غير صالح");
    const { error } = await context.supabase
      .from("customer_balances")
      .upsert(
        {
          phone,
          name: data.name ?? "",
          initial_balance: data.initial_balance,
        },
        { onConflict: "phone" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Listing: grouped by customer_phone with balances ----------
export const listFollowupGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);

    const { data: invoices, error } = await context.supabase
      .from("invoices")
      .select(
        "id, customer_name, customer_phone, invoice_number, amount, paid_amount, payment_status, last_reminder_at, created_at, sent_at, status",
      )
      .eq("status", "sent")
      .neq("payment_status", "paid")
      .order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: balances, error: be } = await context.supabase
      .from("customer_balances")
      .select("phone, name, initial_balance");
    if (be) throw new Error(be.message);

    const balanceMap = new Map<string, { name: string; initial_balance: number }>();
    for (const b of balances ?? []) {
      balanceMap.set(normalisePhone((b as any).phone), {
        name: (b as any).name ?? "",
        initial_balance: num((b as any).initial_balance),
      });
    }

    const now = Date.now();
    const groupMap = new Map<string, ClientGroup>();

    for (const raw of invoices ?? []) {
      const inv = raw as any;
      const phone = normalisePhone(inv.customer_phone);
      if (!phone) continue;
      let g = groupMap.get(phone);
      if (!g) {
        const bal = balanceMap.get(phone);
        g = {
          phone,
          name: bal?.name || inv.customer_name || "",
          initial_balance: bal?.initial_balance ?? 0,
          invoices_total: 0,
          total_paid: 0,
          current_balance: 0,
          invoices: [],
          has_overdue: false,
          oldest_unpaid_sent_at: null,
        };
        groupMap.set(phone, g);
      }
      if (!g.name && inv.customer_name) g.name = inv.customer_name;

      const amount = num(inv.amount);
      const paid = Math.min(num(inv.paid_amount), amount);
      const remaining = Math.max(0, amount - paid);
      const sentAt: string | null = inv.sent_at ?? null;
      const isOverdue =
        sentAt != null &&
        inv.payment_status !== "paid" &&
        now - new Date(sentAt).getTime() >= 86400000;

      const ci: ClientInvoice = {
        id: inv.id,
        invoice_number: String(inv.invoice_number ?? ""),
        amount,
        paid_amount: paid,
        remaining,
        payment_status: (inv.payment_status ?? "unpaid") as ClientInvoice["payment_status"],
        sent_at: sentAt,
        last_reminder_at: inv.last_reminder_at ?? null,
        is_overdue: isOverdue,
      };
      g.invoices.push(ci);
      g.invoices_total += amount;
      g.total_paid += paid;
      if (isOverdue) g.has_overdue = true;
      if (sentAt && (!g.oldest_unpaid_sent_at || sentAt < g.oldest_unpaid_sent_at)) {
        g.oldest_unpaid_sent_at = sentAt;
      }
    }

    // Also include customers with only initial_balance (no invoices) — optional
    for (const [phone, bal] of balanceMap.entries()) {
      if (groupMap.has(phone)) continue;
      if ((bal.initial_balance ?? 0) <= 0) continue;
      groupMap.set(phone, {
        phone,
        name: bal.name,
        initial_balance: bal.initial_balance,
        invoices_total: 0,
        total_paid: 0,
        current_balance: bal.initial_balance,
        invoices: [],
        has_overdue: false,
        oldest_unpaid_sent_at: null,
      });
    }

    const groups: ClientGroup[] = [];
    for (const g of groupMap.values()) {
      g.current_balance = Math.max(0, g.initial_balance + g.invoices_total - g.total_paid);
      g.invoices.sort((a, b) =>
        (a.sent_at || "").localeCompare(b.sent_at || ""),
      );
      groups.push(g);
    }
    groups.sort((a, b) => {
      if (a.has_overdue !== b.has_overdue) return a.has_overdue ? -1 : 1;
      return b.current_balance - a.current_balance;
    });

    return { groups };
  });

// ---------- Scan & dispatch ----------
export async function runFollowupScan(supabaseAdmin: any) {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 86400000).toISOString();
  const oneDayAgo = cutoff;

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
