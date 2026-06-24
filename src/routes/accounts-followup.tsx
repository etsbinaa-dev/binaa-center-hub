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
  upsertCustomerBalance,
  applyClientPayment,
  type ClientGroup,
  type ClientInvoice,
} from "@/lib/accounts-followup.functions";


export const Route = createFileRoute("/accounts-followup")({
  head: () => ({ meta: [{ title: "متابعة الدفع — بِناء HUB" }] }),
  component: AccountsFollowupRoute,
  errorComponent: ({ error, reset }) => (
    <FollowupErrorFallback error={error} onReset={reset} source="route-error-component" />
  ),
});

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

function AccountsFollowupPage() {
  const fetchList = useServerFn(listFollowupGroups);
  const saveAmount = useServerFn(setInvoiceAmount);
  const runScan = useServerFn(runFollowupScanFn);
  const applyPayment = useServerFn(applyInvoicePayment);
  const saveBalance = useServerFn(upsertCustomerBalance);
  const clientPay = useServerFn(applyClientPayment);


  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [editingAmount, setEditingAmount] = useState<Record<string, string>>({});
  const [editingBalance, setEditingBalance] = useState<Record<string, string>>({});

  async function reload() {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetchList();
      const list = Array.isArray((r as any)?.groups) ? (r as any).groups as ClientGroup[] : [];
      setGroups(list);
    } catch (e) {
      logErr("reload", e);
      toast.error(getErrorMessage(e) || "تعذر تحميل البيانات");
      setGroups([]);
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
        setGroups([]);
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

  const stats = useMemo(() => {
    const customers = groups.length;
    const overdue = groups.filter((g) => g.has_overdue).length;
    const totalRemaining = groups.reduce((s, g) => s + g.current_balance, 0);
    return { customers, overdue, totalRemaining };
  }, [groups]);

  async function distributePayment(g: ClientGroup, amount: number): Promise<number> {
    let remaining = amount;
    const unpaid = g.invoices
      .filter((i) => i.payment_status !== "paid")
      .slice()
      .sort((a, b) => (a.sent_at || "").localeCompare(b.sent_at || ""));
    for (const inv of unpaid) {
      if (remaining <= 0) break;
      if (inv.amount <= 0) continue;
      const invRem = inv.remaining;
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

  function buildWaLink(g: ClientGroup): string | null {
    if (!g.phone) return null;
    const lines = g.invoices
      .filter((i) => i.payment_status !== "paid")
      .map((i) => `• فاتورة ${i.invoice_number || "—"}: ${fmtMoney(i.remaining)} MRO`)
      .join("\n");
    const parts = [
      `مرحباً ${g.name || ""}،`,
      `تذكير بخصوص حسابكم لدينا:`,
      `الرصيد المستحق: ${fmtMoney(g.current_balance)} MRO`,
      lines,
    ].filter(Boolean);
    return `https://wa.me/${g.phone}?text=${encodeURIComponent(parts.join("\n"))}`;
  }

  async function onSaveBalance(g: ClientGroup) {
    const v = editingBalance[g.phone];
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("مبلغ غير صالح");
      return;
    }
    try {
      await saveBalance({ data: { phone: g.phone, name: g.name, current_balance: n } });
      toast.success("تم حفظ الرصيد");
      setEditingBalance((s) => { const c = { ...s }; delete c[g.phone]; return c; });
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onFullPay(inv: ClientInvoice) {
    if (!window.confirm(`تأكيد تسديد كامل لفاتورة ${inv.invoice_number || "—"}؟`)) return;
    try {
      await applyPayment({ data: { invoice_id: inv.id, mode: "full" } });
      toast.success("تم تسديد الفاتورة كاملة");
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onPartialPay(inv: ClientInvoice) {
    if (inv.remaining <= 0) {
      toast.error("لا يوجد متبقي");
      return;
    }
    const input = window.prompt(`كم تم دفعه؟ (المتبقي ${fmtMoney(inv.remaining)} MRO)`);
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

  async function onSaveAmount(inv: ClientInvoice) {
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
      setEditingAmount((s) => { const c = { ...s }; delete c[inv.id]; return c; });
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

  const renderInvoiceRow = (inv: ClientInvoice) => {
    const days = daysSince(inv.sent_at);
    const overdueInv = inv.is_overdue;
    const invStatus =
      inv.payment_status === "paid"
        ? { cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200", text: "مدفوعة" }
        : inv.paid_amount > 0
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
                <span>{fmtMoney(inv.amount)}</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setEditingAmount((s) => ({ ...s, [inv.id]: String(inv.amount) }))}
                  title="تعديل المبلغ"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">المدفوع</div>
            <div className="font-bold text-green-700 dark:text-green-300">{fmtMoney(inv.paid_amount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">المتبقي</div>
            <div className="font-bold text-amber-700 dark:text-amber-300">{fmtMoney(inv.remaining)}</div>
          </div>
        </div>
      </li>
    );
  };

  const renderGroup = (g: ClientGroup) => {
    const waLink = buildWaLink(g);
    const isOpen = openDetails[g.phone] ?? false;
    const unpaidCount = g.invoices.filter((i) => i.payment_status !== "paid").length;
    const isEditingBalance = editingBalance[g.phone] != null;
    const maxDays = g.oldest_unpaid_sent_at ? daysSince(g.oldest_unpaid_sent_at) : 0;
    return (
      <div
        key={g.phone}
        className={`rounded-lg border p-3 space-y-2 ${g.has_overdue ? "border-orange-400 bg-orange-50/40 dark:bg-orange-950/20" : ""}`}
      >
        {/* اسم العميل فوق الأزرار */}
        <div>
          <div className="font-bold text-base">{g.name || "—"}</div>
          <div className="text-xs text-muted-foreground" dir="ltr">{g.phone || "—"}</div>
          {g.has_overdue && (
            <span className="mt-1 inline-block rounded-full bg-orange-500 text-white px-2 py-0.5 text-[10px] font-bold">
              متأخر {maxDays} يوم
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0" />
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {waLink && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => window.open(waLink, "_blank", "noopener,noreferrer")}
              >
                <Send className="h-4 w-4 ml-1" /> واتساب
              </Button>
            )}
            <button
              onClick={async () => {
                const input = window.prompt(`الرصيد الحالي: ${fmtMoney(g.current_balance)}\nكم تم دفعه؟`);
                if (input == null) return;
                const amount = Number(input);
                if (!Number.isFinite(amount) || amount <= 0) { toast.error("مبلغ غير صالح"); return; }
                try {
                  await clientPay({ data: { phone: g.phone, name: g.name, mode: "partial", amount } });
                  toast.success("تم تسجيل الدفعة");
                  reload();
                } catch (e) { toast.error(getErrorMessage(e)); }
              }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted transition-colors"
            >
              دفع جزئي
            </button>
            <button
              onClick={async () => {
                if (!window.confirm(`تأكيد تسديد رصيد ${g.name} بالكامل؟`)) return;
                try {
                  await clientPay({ data: { phone: g.phone, name: g.name, mode: "full" } });
                  toast.success("تم تسديد الرصيد بالكامل ✅");
                  reload();
                } catch (e) { toast.error(getErrorMessage(e)); }
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              تسديد كامل
            </button>
          </div>

        </div>

        {/* Current balance card — click to edit */}
        <div className="rounded-md border-2 border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 p-3 text-center">
          <div className="text-[11px] text-muted-foreground">الرصيد الحالي المستحق</div>
          {isEditingBalance ? (
            <div className="mt-1 flex items-center justify-center gap-1">
              <input
                className="w-32 rounded border px-2 py-1 text-lg text-center font-bold"
                value={editingBalance[g.phone]}
                onChange={(e) => setEditingBalance((s) => ({ ...s, [g.phone]: e.target.value }))}
                inputMode="decimal"
                autoFocus
              />
              <button onClick={() => onSaveBalance(g)} className="text-green-600" title="حفظ">
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={() => setEditingBalance((s) => { const c = { ...s }; delete c[g.phone]; return c; })}
                className="text-red-600"
                title="إلغاء"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-1 w-full text-2xl font-bold text-amber-700 dark:text-amber-300 hover:opacity-80"
              onClick={() => setEditingBalance((s) => ({ ...s, [g.phone]: String(g.current_balance) }))}
              title="اضغط للتعديل"
            >
              {fmtMoney(g.current_balance)} <span className="text-xs">MRO</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="text-xs text-primary underline"
            onClick={() => setOpenDetails((s) => ({ ...s, [g.phone]: !isOpen }))}
          >
            {unpaidCount} فاتورة غير مسددة {isOpen ? "▲" : "▼"}
          </button>
        </div>

        {isOpen && g.invoices.length > 0 && (
          <ul className="space-y-2">{g.invoices.map(renderInvoiceRow)}</ul>
        )}
      </div>
    );
  };

  const overdueGroups = groups.filter((g) => g.has_overdue);
  const regularGroups = groups.filter((g) => !g.has_overdue);

  return (
    <AppShell moduleKey="accounts_followup" title="متابعة الدفع">
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">عملاء بحسابات قائمة</div>
            <div className="text-xl font-bold">{stats.customers}</div>
          </Card>
          <Card className="p-3 text-center border-orange-400">
            <div className="text-[10px] text-muted-foreground">متأخرون</div>
            <div className="text-xl font-bold text-orange-600">{stats.overdue}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">إجمالي المستحق</div>
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

        {loading ? (
          <Card className="p-4">
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="p-4">
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا توجد حسابات قائمة حالياً.
            </div>
          </Card>
        ) : (
          <>
            {overdueGroups.length > 0 && (
              <Card className="p-4 space-y-3 border-orange-300">
                <h2 className="text-base font-bold text-orange-700 dark:text-orange-300">
                  حسابات متأخرة ({overdueGroups.length})
                </h2>
                <div className="space-y-3">{overdueGroups.map(renderGroup)}</div>
              </Card>
            )}
            {regularGroups.length > 0 && (
              <Card className="p-4 space-y-3">
                <h2 className="text-base font-bold">حسابات قائمة ({regularGroups.length})</h2>
                <div className="space-y-3">{regularGroups.map(renderGroup)}</div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
