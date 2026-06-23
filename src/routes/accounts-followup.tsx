import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCcw, Send, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listFollowupGroups,
  setInvoiceAmount,
  runFollowupScanFn,
  applyInvoicePayment,
} from "@/lib/accounts-followup.functions";

export const Route = createFileRoute("/accounts-followup")({
  head: () => ({ meta: [{ title: "متابعة الدفع — بِناء HUB" }] }),
  component: AccountsFollowupRoute,
  errorComponent: ({ error, reset }) => (
    <FollowupErrorFallback error={error} onReset={reset} source="route-error-component" />
  ),
});

type Invoice = {
  id: string;
  customer_name: string;
  customer_phone: string;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  payment_status: string;
  paid_at: string | null;
  last_reminder_at: string | null;
  created_at: string;
  sent_at: string | null;
};

type Group = {
  key: string;
  customer_name: string;
  customer_phone: string;
  invoices: Invoice[];
  total: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid";
  maxDaysOverdue: number;
  overdue: boolean;
};

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

function logErr(src: string, e: unknown) {
  console.error(`[followup] ${src}:`, e);
}

function FollowupErrorFallback({ error, onReset, source }: { error: unknown; onReset?: () => void; source: string }) {
  logErr(source, error);
  return (
    <AppShell moduleKey="accounts_followup" title="متابعة الدفع">
      <div className="mx-auto max-w-3xl pb-12">
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-bold">تعذر عرض متابعة الدفع</h2>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground" dir="ltr">
            {getErrorMessage(error)}
          </pre>
          {onReset && (
            <Button size="sm" variant="outline" onClick={onReset}>
              <RefreshCcw className="h-4 w-4 ml-1" /> إعادة المحاولة
            </Button>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

class FollowupErrorBoundary extends Component<{ children: ReactNode }, { error: unknown | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown, info: ErrorInfo) { logErr("react-eb", { error, info }); }
  render() {
    if (this.state.error) {
      return <FollowupErrorFallback error={this.state.error} source="react-eb" onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function AccountsFollowupRoute() {
  return (
    <FollowupErrorBoundary>
      <AccountsFollowupPage />
    </FollowupErrorBoundary>
  );
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  try {
    return new Date(v as string).toLocaleDateString("ar");
  } catch {
    return "—";
  }
}

function daysSince(v: unknown): number {
  if (!v) return 0;
  const t = new Date(v as string).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

function normaliseInvoice(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;
  return {
    id,
    customer_name: typeof r.customer_name === "string" ? r.customer_name : "",
    customer_phone: typeof r.customer_phone === "string" ? r.customer_phone : "",
    invoice_number: typeof r.invoice_number === "string" ? r.invoice_number : String(r.invoice_number ?? ""),
    amount: num(r.amount),
    paid_amount: num(r.paid_amount),
    payment_status: typeof r.payment_status === "string" ? r.payment_status : "unpaid",
    paid_at: typeof r.paid_at === "string" ? r.paid_at : null,
    last_reminder_at: typeof r.last_reminder_at === "string" ? r.last_reminder_at : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    sent_at: typeof r.sent_at === "string" ? r.sent_at : null,
  };
}

function AccountsFollowupPage() {
  const fetchList = useServerFn(listFollowupGroups);
  const saveAmount = useServerFn(setInvoiceAmount);
  const runScan = useServerFn(runFollowupScanFn);
  const applyPayment = useServerFn(applyInvoicePayment);

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [editingAmount, setEditingAmount] = useState<Record<string, string>>({});

  async function reload() {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetchList();
      const list = Array.isArray((r as any)?.invoices) ? (r as any).invoices : [];
      const clean = list.map(normaliseInvoice).filter((x: Invoice | null): x is Invoice => Boolean(x));
      setInvoices(clean);
    } catch (e) {
      logErr("reload", e);
      toast.error(getErrorMessage(e) || "تعذر تحميل البيانات");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session?.access_token) {
        setLoading(false);
        navigate({ to: "/auth" }).catch(() => {});
        return;
      }
      reload();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.access_token) {
        setInvoices([]);
      } else if (event === "SIGNED_IN") {
        reload();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const inv of invoices) {
      const phone = (inv.customer_phone || "").replace(/[^\d]/g, "");
      const key = phone || `name:${inv.customer_name || inv.id}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          customer_name: inv.customer_name || inv.customer_phone || "—",
          customer_phone: inv.customer_phone || "",
          invoices: [],
          total: 0,
          paid: 0,
          remaining: 0,
          status: "unpaid",
          maxDaysOverdue: 0,
          overdue: false,
        };
        map.set(key, g);
      }
      g.invoices.push(inv);
      if (!g.customer_phone && inv.customer_phone) g.customer_phone = inv.customer_phone;
      if ((!g.customer_name || g.customer_name === "—") && inv.customer_name) g.customer_name = inv.customer_name;
    }
    const out: Group[] = [];
    for (const g of map.values()) {
      g.invoices.sort((a, b) => (a.sent_at || a.created_at).localeCompare(b.sent_at || b.created_at));
      let total = 0, paid = 0, allPaid = true, anyPaid = false, maxDays = 0;
      for (const inv of g.invoices) {
        const amt = inv.amount;
        const p = Math.min(inv.paid_amount, amt);
        total += amt;
        paid += p;
        if (inv.payment_status !== "paid") allPaid = false;
        if (p > 0) anyPaid = true;
        const d = daysSince(inv.sent_at);
        if (d > maxDays) maxDays = d;
      }
      g.total = total;
      g.paid = paid;
      g.remaining = Math.max(0, total - paid);
      g.status = allPaid ? "paid" : anyPaid ? "partial" : "unpaid";
      g.maxDaysOverdue = maxDays;
      g.overdue = maxDays >= 1 && g.status !== "paid";
      out.push(g);
    }
    out.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return b.remaining - a.remaining;
    });
    return out;
  }, [invoices]);

  const stats = useMemo(() => {
    const active = groups.filter((g) => g.status !== "paid");
    const overdue = active.filter((g) => g.overdue).length;
    const totalRemaining = active.reduce((s, g) => s + g.remaining, 0);
    return { customers: active.length, overdue, totalRemaining };
  }, [groups]);

  const statusBadge = (status: Group["status"]) =>
    status === "paid"
      ? { cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200", text: "مدفوع" }
      : status === "partial"
        ? { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200", text: "جزئي" }
        : { cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", text: "غير مدفوع" };

  async function distributePayment(g: Group, amount: number): Promise<number> {
    let remaining = amount;
    const unpaid = g.invoices
      .filter((i) => i.payment_status !== "paid")
      .slice()
      .sort((a, b) => (a.sent_at || a.created_at).localeCompare(b.sent_at || b.created_at));
    for (const inv of unpaid) {
      if (remaining <= 0) break;
      const amt = inv.amount;
      if (amt <= 0) continue;
      const invRem = Math.max(0, amt - Math.min(inv.paid_amount, amt));
      if (invRem <= 0) continue;
      const apply = Math.min(remaining, invRem);
      if (apply >= invRem) {
        await applyPayment({ data: { invoice_id: inv.id, mode: "full" } });
      } else {
        await applyPayment({ data: { invoice_id: inv.id, mode: "partial", amount: apply } });
      }
      remaining -= apply;
    }
    return amount - remaining;
  }

  function buildWaLink(g: Group): string | null {
    const digits = (g.customer_phone || "").replace(/[^\d]/g, "");
    if (!digits) return null;
    const lines = g.invoices
      .filter((i) => i.payment_status !== "paid")
      .map((i) => {
        const rem = Math.max(0, i.amount - Math.min(i.paid_amount, i.amount));
        return `• فاتورة ${i.invoice_number || "—"}: ${fmtMoney(rem)} MRO`;
      })
      .join("\n");
    const msg = `مرحباً ${g.customer_name}،\nتذكير بخصوص حسابكم:\nالإجمالي: ${fmtMoney(g.total)} MRO\nالمدفوع: ${fmtMoney(g.paid)} MRO\nالمتبقي: ${fmtMoney(g.remaining)} MRO\n${lines}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  }

  async function onRecordPayment(g: Group) {
    if (g.remaining <= 0) {
      toast.error("لا يوجد متبقي");
      return;
    }
    const input = window.prompt(`كم تم دفعه الآن؟ (المتبقي الكلي ${fmtMoney(g.remaining)} MRO)`);
    if (input == null) return;
    const add = Number(input);
    if (!Number.isFinite(add) || add <= 0) {
      toast.error("مبلغ غير صالح");
      return;
    }
    try {
      const applied = await distributePayment(g, add);
      toast.success(`تم تسجيل دفعة بقيمة ${fmtMoney(applied)} MRO`);
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onFullPay(inv: Invoice) {
    if (!window.confirm(`تأكيد تسديد كامل لفاتورة ${inv.invoice_number || "—"}؟`)) return;
    try {
      await applyPayment({ data: { invoice_id: inv.id, mode: "full" } });
      toast.success("تم تسديد الفاتورة كاملة");
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onPartialPay(inv: Invoice) {
    const rem = Math.max(0, inv.amount - Math.min(inv.paid_amount, inv.amount));
    if (rem <= 0) {
      toast.error("لا يوجد متبقي");
      return;
    }
    const input = window.prompt(`كم تم دفعه؟ (المتبقي ${fmtMoney(rem)} MRO)`);
    if (input == null) return;
    const add = Number(input);
    if (!Number.isFinite(add) || add <= 0) {
      toast.error("مبلغ غير صالح");
      return;
    }
    try {
      await applyPayment({ data: { invoice_id: inv.id, mode: "partial", amount: add } });
      toast.success("تم تسجيل الدفعة");
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onSaveAmount(inv: Invoice) {
    const v = editingAmount[inv.id];
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("مبلغ غير صالح");
      return;
    }
    try {
      await saveAmount({ data: { invoice_id: inv.id, amount: n } });
      toast.success("تم تحديث المبلغ");
      setEditingAmount((s) => {
        const c = { ...s };
        delete c[inv.id];
        return c;
      });
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onRunScan() {
    setBusy(true);
    try {
      const r = await runScan();
      const sent = (r as any)?.sent ?? 0;
      toast.success(`تم الفحص — تذكيرات أُرسلت: ${sent}`);
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const renderInvoiceRow = (inv: Invoice) => {
    const amt = inv.amount;
    const p = Math.min(inv.paid_amount, amt);
    const rem = Math.max(0, amt - p);
    const days = daysSince(inv.sent_at);
    const overdueInv = days >= 1 && inv.payment_status !== "paid";
    const invStatus =
      inv.payment_status === "paid"
        ? { cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200", text: "مدفوعة" }
        : p > 0
          ? { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200", text: "جزئي" }
          : overdueInv
            ? { cls: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200", text: "متأخرة" }
            : { cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", text: "غير مدفوعة" };
    const editing = editingAmount[inv.id] != null;
    return (
      <li key={inv.id} className="rounded-md border bg-muted/20 p-2 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="font-semibold">فاتورة {inv.invoice_number || "—"}</div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${invStatus.cls}`}>
            {invStatus.text}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          📅 {fmtDate(inv.sent_at)} {days > 0 && inv.payment_status !== "paid" ? `· مرّ ${days} يوم` : ""}
        </div>
        <div className="grid grid-cols-3 gap-1 text-center text-xs">
          <div>
            <div className="text-muted-foreground text-[10px]">الأصلي</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  className="w-full rounded border px-1 py-0.5 text-xs text-center"
                  value={editingAmount[inv.id]}
                  onChange={(e) => setEditingAmount((s) => ({ ...s, [inv.id]: e.target.value }))}
                  inputMode="decimal"
                />
                <button onClick={() => onSaveAmount(inv)} className="text-green-600">
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setEditingAmount((s) => { const c = { ...s }; delete c[inv.id]; return c; })}
                  className="text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 font-bold">
                <span>{fmtMoney(amt)}</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setEditingAmount((s) => ({ ...s, [inv.id]: String(amt) }))}
                  title="تعديل المبلغ"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">المدفوع</div>
            <div className="font-bold text-green-700 dark:text-green-300">{fmtMoney(p)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">المتبقي</div>
            <div className="font-bold text-amber-700 dark:text-amber-300">{fmtMoney(rem)}</div>
          </div>
        </div>
        {inv.payment_status !== "paid" && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onPartialPay(inv)}>
              دفع جزئي
            </Button>
            <Button size="sm" className="h-7 text-[11px]" onClick={() => onFullPay(inv)}>
              تسديد كامل
            </Button>
          </div>
        )}
      </li>
    );
  };

  const renderGroup = (g: Group) => {
    const b = statusBadge(g.status);
    const waLink = buildWaLink(g);
    const isOpen = openDetails[g.key] ?? false;
    const unpaidCount = g.invoices.filter((i) => i.payment_status !== "paid").length;
    return (
      <div
        key={g.key}
        className={`rounded-lg border p-3 space-y-2 ${g.overdue ? "border-orange-400 bg-orange-50/40 dark:bg-orange-950/20" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{g.customer_name}</div>
            <div className="text-xs text-muted-foreground" dir="ltr">
              {g.customer_phone || "—"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.cls}`}>{b.text}</span>
              {g.overdue && (
                <span className="rounded-full bg-orange-500 text-white px-2 py-0.5 text-[10px] font-bold">
                  متأخر {g.maxDaysOverdue} يوم
                </span>
              )}
            </div>
          </div>
          {waLink && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => window.open(waLink, "_blank", "noopener,noreferrer")}
            >
              <Send className="h-4 w-4 ml-1" /> واتساب
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2 text-center text-xs">
          <div>
            <div className="text-muted-foreground text-[10px]">الإجمالي</div>
            <div className="font-bold">{fmtMoney(g.total)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">المدفوع</div>
            <div className="font-bold text-green-700 dark:text-green-300">{fmtMoney(g.paid)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">المتبقي</div>
            <div className="font-bold text-amber-700 dark:text-amber-300">{fmtMoney(g.remaining)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setOpenDetails((s) => ({ ...s, [g.key]: !isOpen }))}
          >
            {isOpen ? "إخفاء" : "عرض"} التفاصيل ({unpaidCount} غير مسددة)
          </button>
          {g.status !== "paid" && (
            <Button size="sm" onClick={() => onRecordPayment(g)}>
              تسجيل دفعة
            </Button>
          )}
        </div>

        {isOpen && (
          <ul className="space-y-2">{g.invoices.map(renderInvoiceRow)}</ul>
        )}
      </div>
    );
  };

  const active = groups.filter((g) => g.status !== "paid");

  return (
    <AppShell moduleKey="accounts_followup" title="متابعة الدفع">
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">عملاء بحسابات قائمة</div>
            <div className="text-xl font-bold">{stats.customers}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">متأخرون</div>
            <div className="text-xl font-bold text-orange-600">{stats.overdue}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">إجمالي المتبقي</div>
            <div className="text-base font-bold text-amber-700 dark:text-amber-300">
              {fmtMoney(stats.totalRemaining)}
            </div>
            <div className="text-[10px] text-muted-foreground">MRO</div>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={busy} onClick={onRunScan}>
            <RefreshCcw className={`h-4 w-4 ml-1 ${busy ? "animate-spin" : ""}`} />
            فحص وإرسال التذكيرات
          </Button>
        </div>

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-bold">الحسابات القائمة</h2>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : active.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا توجد حسابات قائمة حالياً.
            </div>
          ) : (
            <div className="space-y-3">{active.map(renderGroup)}</div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
