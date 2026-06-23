import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Save, RefreshCcw, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import {
  getFollowupSettings,
  updateFollowupSettings,
  listMajorAccounts,
  setInvoiceAmount,
  respondReminder,
  runFollowupScanFn,
  applyInvoicePayment,
} from "@/lib/accounts-followup.functions";

export const Route = createFileRoute("/accounts-followup")({
  head: () => ({ meta: [{ title: "متابعة الدفع — بِناء HUB" }] }),
  component: AccountsFollowupRoute,
  errorComponent: ({ error, reset }) => (
    <FollowupErrorFallback
      error={error}
      onReset={reset}
      source="route-error-component"
    />
  ),
});

type Settings = { threshold_amount: number; initial_delay_days: number; snooze_days: number };
type Invoice = {
  id: string;
  customer_name: string;
  customer_phone: string;
  invoice_number: string;
  amount: number | null;
  paid_amount: number;
  payment_status: string;
  paid_at: string | null;
  last_reminder_at: string | null;
  created_at: string;
  sent_at: string | null;
};
type Reminder = {
  id: string;
  invoice_id: string;
  status: string;
  message: string;
  due_at: string;
  responded_at: string | null;
  next_remind_at: string | null;
  created_at: string;
};

const EMPTY_LIST: unknown[] = [];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown Follow-up page error";
  }
}

function logFollowupError(source: string, error: unknown, details?: Record<string, unknown>) {
  const message = getErrorMessage(error);
  console.error(`[followup] ${source}: ${message}`, { error, ...details });
}

function FollowupErrorFallback({
  error,
  onReset,
  source,
}: {
  error: unknown;
  onReset?: () => void;
  source: string;
}) {
  const message = getErrorMessage(error);
  logFollowupError(source, error);
  return (
    <AppShell moduleKey="accounts_followup" title="متابعة الدفع">
      <div className="mx-auto max-w-3xl pb-12">
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-bold">تعذر عرض متابعة الدفع</h2>
          <p className="text-sm text-muted-foreground">
            تم منع انهيار الصفحة. لا توجد بيانات قابلة للعرض حالياً.
          </p>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground" dir="ltr">
            {message || "Unknown error"}
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

class FollowupPageErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    logFollowupError("react-error-boundary", error, {
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <FollowupErrorFallback
          error={this.state.error}
          source="react-error-boundary-fallback"
          onReset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function AccountsFollowupRoute() {
  return (
    <FollowupPageErrorBoundary>
      <AccountsFollowupPage />
    </FollowupPageErrorBoundary>
  );
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isFinite(d.getTime()) ? d : null;
}
function safeFormatDate(v: unknown): string {
  const d = safeDate(v);
  try {
    return d ? d.toLocaleDateString("ar") : "—";
  } catch {
    return d ? d.toISOString().slice(0, 10) : "—";
  }
}
function safeFormatDateTime(v: unknown): string {
  const d = safeDate(v);
  try {
    return d ? d.toLocaleString("ar") : "—";
  } catch {
    return d ? d.toISOString() : "—";
  }
}

function safeText(v: unknown, fallback = "—"): string {
  if (typeof v === "string") return v.trim() || fallback;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function normaliseInvoice(inv: unknown): Invoice | null {
  try {
    if (!inv || typeof inv !== "object") {
      console.warn("[followup] skipping corrupted invoice: not an object", inv);
      return null;
    }
    const row = inv as Record<string, unknown>;
    const id = safeText(row.id, "");
    if (!id) {
      console.warn("[followup] skipping corrupted invoice: missing id", inv);
      return null;
    }
    const amount = safeNum(row.amount);
    if (row.amount == null || !Number.isFinite(Number(row.amount))) {
      console.warn("[followup] invoice amount missing or invalid; using 0", {
        invoice_id: id,
        field: "amount",
        value: row.amount,
      });
    }
    return {
      id,
      customer_name: safeText(row.customer_name),
      customer_phone: safeText(row.customer_phone, ""),
      invoice_number: safeText(row.invoice_number),
      amount,
      paid_amount: safeNum(row.paid_amount),
      payment_status: safeText(row.payment_status, "unpaid"),
      paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
      last_reminder_at: typeof row.last_reminder_at === "string" ? row.last_reminder_at : null,
      created_at: safeDate(row.created_at)?.toISOString() ?? "",
      sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
    };
  } catch (error) {
    logFollowupError("normalise-invoice", error, { invoice: inv });
    return null;
  }
}

function normaliseReminder(reminder: unknown): Reminder | null {
  try {
    if (!reminder || typeof reminder !== "object") {
      console.warn("[followup] skipping corrupted reminder: not an object", reminder);
      return null;
    }
    const row = reminder as Record<string, unknown>;
    const id = safeText(row.id, "");
    const invoiceId = safeText(row.invoice_id, "");
    if (!id || !invoiceId) {
      console.warn("[followup] skipping corrupted reminder: missing id or invoice_id", reminder);
      return null;
    }
    return {
      id,
      invoice_id: invoiceId,
      status: safeText(row.status, "pending"),
      message: safeText(row.message, ""),
      due_at: safeDate(row.due_at)?.toISOString() ?? "",
      responded_at: typeof row.responded_at === "string" ? row.responded_at : null,
      next_remind_at: typeof row.next_remind_at === "string" ? row.next_remind_at : null,
      created_at: safeDate(row.created_at)?.toISOString() ?? "",
    };
  } catch (error) {
    logFollowupError("normalise-reminder", error, { reminder });
    return null;
  }
}

function AccountsFollowupPage() {
  const fetchSettings = useServerFn(getFollowupSettings);
  const saveSettings = useServerFn(updateFollowupSettings);
  const fetchList = useServerFn(listMajorAccounts);
  const saveAmount = useServerFn(setInvoiceAmount);
  const respond = useServerFn(respondReminder);
  const runScan = useServerFn(runFollowupScanFn);
  const applyPayment = useServerFn(applyInvoicePayment);

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    threshold_amount: 50000,
    initial_delay_days: 2,
    snooze_days: 3,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const remindersByInvoice = useMemo(() => {
    const m: Record<string, Reminder[]> = {};
    for (const r of reminders) {
      if (!r || !r.invoice_id) continue;
      (m[r.invoice_id] ||= []).push(r);
    }
    return m;
  }, [reminders]);

  async function reload() {
    // Guard: never call protected server fns without an authenticated session.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) {
      console.warn("[followup] reload skipped: no authenticated session");
      setInvoices([]);
      setReminders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, l] = await Promise.all([fetchSettings(), fetchList()]);
      const sx = (s as Record<string, unknown>) ?? {};
      setSettings({
        threshold_amount: safeNum(sx.threshold_amount) || 50000,
        initial_delay_days: safeNum(sx.initial_delay_days) || 2,
        snooze_days: safeNum(sx.snooze_days) || 3,
      });
      const listPayload = (l as { invoices?: unknown[]; reminders?: unknown[] }) ?? {};
      const rawInvoices = Array.isArray(listPayload.invoices) ? listPayload.invoices : EMPTY_LIST;
      const cleanInvoices = rawInvoices
        .map((inv) => normaliseInvoice(inv))
        .filter((inv): inv is Invoice => Boolean(inv));
      setInvoices(cleanInvoices);
      const rawReminders = Array.isArray(listPayload.reminders) ? listPayload.reminders : EMPTY_LIST;
      setReminders(
        rawReminders
          .map((reminder) => normaliseReminder(reminder))
          .filter((reminder): reminder is Reminder => Boolean(reminder)),
      );
    } catch (e) {
      logFollowupError("reload", e);
      setInvoices([]);
      setReminders([]);
      toast.error((e as Error)?.message ?? "تعذر تحميل البيانات");
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
        console.warn("[followup] no session — redirecting to /auth");
        setLoading(false);
        navigate({ to: "/auth" }).catch(() => {});
        return;
      }
      reload();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.access_token) {
        setInvoices([]);
        setReminders([]);
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


  return (
    <AppShell moduleKey="accounts_followup" title="متابعة الدفع">
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        {/* Settings */}
        <Card className="p-4 space-y-3">
          <h2 className="text-base font-bold">إعدادات المتابعة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">حد المبلغ الكبير</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={settings.threshold_amount}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, threshold_amount: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">التذكير الأول بعد (أيام)</Label>
              <Input
                type="number"
                min={1}
                value={settings.initial_delay_days}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, initial_delay_days: Number(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إعادة التذكير بعد (أيام)</Label>
              <Input
                type="number"
                min={1}
                value={settings.snooze_days}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, snooze_days: Number(e.target.value) || 1 }))
                }
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveSettings({ data: settings });
                  toast.success("تم حفظ الإعدادات");
                  reload();
                } catch (e: any) {
                  toast.error(e?.message ?? "فشل الحفظ");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save className="h-4 w-4 ml-1" /> حفظ
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await runScan();
                  toast.success(`تم الفحص — تذكيرات جديدة: ${r.created}`);
                  reload();
                } catch (e: any) {
                  toast.error(e?.message ?? "فشل الفحص");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCcw className="h-4 w-4 ml-1" /> فحص الآن
            </Button>
          </div>
        </Card>

        {/* Pending reminders */}
        {(() => {
          const pending = reminders.filter((r) => r.status === "pending");
          if (!pending.length) return null;
          return (
            <Card className="p-4 space-y-3">
              <h2 className="text-base font-bold">تذكيرات بانتظار الرد</h2>
              <div className="space-y-3">
                {pending.map((r) => {
                  try {
                    const inv = invoices.find((i) => i.id === r.invoice_id);
                    const sentAt = safeDate(inv?.sent_at);
                    const daysElapsed = sentAt
                      ? Math.floor((Date.now() - sentAt.getTime()) / 86400000)
                      : null;
                    const phoneDigits = (inv?.customer_phone ?? "").replace(/[^\d]/g, "");
                    const waMsg = inv
                      ? `مرحباً ${inv.customer_name}، نود الاستفسار بخصوص الفاتورة رقم ${inv.invoice_number}.`
                      : "";
                    const waLink = phoneDigits
                      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waMsg)}`
                      : null;
                    return (
                      <div key={r.id} className="rounded-lg border p-3 space-y-2">
                        <div className="text-sm font-semibold">
                          {inv ? `هل دفع العميل ${inv.customer_name}؟` : r.message}
                        </div>
                        {inv && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>👤 {inv.customer_name}</div>
                            <div dir="ltr">📞 {inv.customer_phone || "—"}</div>
                            <div>🧾 رقم الفاتورة: {inv.invoice_number}</div>
                            <div>💵 المبلغ: {safeNum(inv.amount).toLocaleString("en-US")}</div>
                            <div>📅 تاريخ الإرسال: {safeFormatDate(inv.sent_at)}</div>
                            {daysElapsed != null && (
                              <div>⏱️ مرّ {daysElapsed} يوم على الإرسال</div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              await respond({ data: { reminder_id: r.id, response: "paid" } });
                              toast.success("تم تعليمها كمدفوعة");
                              reload();
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 ml-1" /> مدفوعة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              await respond({ data: { reminder_id: r.id, response: "not_paid" } });
                              toast.message("سيتم تذكيرك لاحقاً");
                              reload();
                            }}
                          >
                            <XCircle className="h-4 w-4 ml-1" /> غير مدفوعة
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await respond({ data: { reminder_id: r.id, response: "snoozed" } });
                              toast.message("ذكّرني لاحقاً");
                              reload();
                            }}
                          >
                            <Clock className="h-4 w-4 ml-1" /> ذكّرني لاحقاً
                          </Button>
                          {waLink && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(waLink, "_blank", "noopener,noreferrer")}
                            >
                              <Send className="h-4 w-4 ml-1" /> واتساب
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  } catch (err) {
                    console.error("[followup] failed to render pending reminder", r, err);
                    return null;
                  }
                })}
              </div>

            </Card>
          );
        })()}

        {/* Major accounts — grouped by customer */}
        {(() => {
          type Group = {
            key: string;
            customer_name: string;
            customer_phone: string;
            invoices: Invoice[];
            total: number;
            paid: number;
            remaining: number;
            status: "paid" | "partial" | "unpaid";
          };

          const groupsMap = new Map<string, Group>();
          for (const inv of invoices) {
            const key = (inv.customer_name || "—").trim() || "—";
            let g = groupsMap.get(key);
            if (!g) {
              g = {
                key,
                customer_name: inv.customer_name || "—",
                customer_phone: inv.customer_phone || "",
                invoices: [],
                total: 0,
                paid: 0,
                remaining: 0,
                status: "paid",
              };
              groupsMap.set(key, g);
            }
            g.invoices.push(inv);
            if (!g.customer_phone && inv.customer_phone) g.customer_phone = inv.customer_phone;
          }
          const groups: Group[] = [];
          for (const g of groupsMap.values()) {
            g.invoices.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
            let total = 0,
              paid = 0;
            let allPaid = true,
              anyPaid = false;
            for (const inv of g.invoices) {
              const amt = safeNum(inv.amount);
              const p = safeNum(inv.paid_amount);
              total += amt;
              paid += Math.min(p, amt);
              if (inv.payment_status !== "paid") allPaid = false;
              if (inv.payment_status === "paid" || (p > 0 && p < amt)) anyPaid = true;
            }
            g.total = total;
            g.paid = paid;
            g.remaining = Math.max(0, total - paid);
            g.status = allPaid ? "paid" : anyPaid ? "partial" : "unpaid";
            groups.push(g);
          }

          const outstanding = groups.filter((g) => g.status !== "paid");
          const settled = groups.filter((g) => g.status === "paid");

          const statusBadge = (status: Group["status"]) =>
            status === "paid"
              ? { cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200", dot: "🟢", text: "مدفوع كلياً" }
              : status === "partial"
                ? { cls: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200", dot: "🟠", text: "مدفوع جزئياً" }
                : { cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", dot: "🟡", text: "غير مدفوع" };

          const renderInvoiceLine = (inv: Invoice) => {
            const amt = safeNum(inv.amount);
            const p = Math.min(safeNum(inv.paid_amount), amt);
            const rem = Math.max(0, amt - p);
            const b = statusBadge(
              inv.payment_status === "paid" ? "paid" : p > 0 ? "partial" : "unpaid",
            );
            return (
              <li key={inv.id} className="rounded-md border bg-muted/20 p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">فاتورة {inv.invoice_number || "—"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.cls}`}>
                    {b.dot} {b.text}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-muted-foreground">المبلغ</div>
                    <div className="font-bold">{amt.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">المدفوع</div>
                    <div className="font-bold text-green-700 dark:text-green-300">{p.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">المتبقي</div>
                    <div className="font-bold text-amber-700 dark:text-amber-300">{rem.toLocaleString()}</div>
                  </div>
                </div>
              </li>
            );
          };

          const distributePayment = async (g: Group, amount: number) => {
            let remaining = amount;
            const unpaid = g.invoices
              .filter((i) => i.payment_status !== "paid")
              .slice()
              .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
            for (const inv of unpaid) {
              if (remaining <= 0) break;
              const amt = safeNum(inv.amount);
              if (amt <= 0) continue;
              const invRem = Math.max(0, amt - Math.min(safeNum(inv.paid_amount), amt));
              if (invRem <= 0) continue;
              const apply = Math.min(remaining, invRem);
              if (apply >= invRem) {
                await applyPayment({ data: { invoice_id: inv.id, mode: "full" } });
              } else {
                await applyPayment({
                  data: { invoice_id: inv.id, mode: "partial", amount: apply },
                });
              }
              remaining -= apply;
            }
            return amount - remaining;
          };

          const renderGroup = (g: Group) => {
            const b = statusBadge(g.status);
            const phoneDigits = (g.customer_phone || "").replace(/[^\d]/g, "");
            const lines = g.invoices
              .filter((i) => i.payment_status !== "paid")
              .map((i) => {
                const amt = safeNum(i.amount);
                const rem = Math.max(0, amt - Math.min(safeNum(i.paid_amount), amt));
                return `• فاتورة ${i.invoice_number || "—"}: المتبقي ${rem.toLocaleString()}`;
              })
              .join("\n");
            const waMsg =
              g.status === "paid"
                ? `مرحباً ${g.customer_name}، شكراً لتسديد كافة الفواتير.`
                : `مرحباً ${g.customer_name}، تذكير بخصوص حسابكم:\nالإجمالي: ${g.total.toLocaleString()}\nالمدفوع: ${g.paid.toLocaleString()}\nالمتبقي: ${g.remaining.toLocaleString()}\n${lines}`;
            const waLink = phoneDigits
              ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waMsg)}`
              : null;

            return (
              <div key={g.key} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{g.customer_name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {g.customer_phone || "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      عدد الفواتير: {g.invoices.length}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.cls}`}>
                    <span className="ml-1">{b.dot}</span>
                    {b.text}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">الإجمالي</div>
                    <div className="font-bold">{g.total.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">المدفوع</div>
                    <div className="font-bold text-green-700 dark:text-green-300">{g.paid.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">المتبقي</div>
                    <div className="font-bold text-amber-700 dark:text-amber-300">{g.remaining.toLocaleString()}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {g.status !== "paid" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (g.remaining <= 0) {
                          toast.error("لا يوجد متبقي");
                          return;
                        }
                        const input = window.prompt(
                          `كم تم دفعه الآن؟ (المتبقي الكلي ${g.remaining.toLocaleString()})`,
                        );
                        if (input == null) return;
                        const add = Number(input);
                        if (!Number.isFinite(add) || add <= 0) {
                          toast.error("مبلغ غير صالح");
                          return;
                        }
                        try {
                          const applied = await distributePayment(g, add);
                          toast.success(`تم تسجيل دفعة بقيمة ${applied.toLocaleString()}`);
                          reload();
                        } catch (e) {
                          toast.error((e as Error)?.message ?? "تعذر تسجيل الدفعة");
                        }
                      }}
                    >
                      تسجيل دفعة
                    </Button>
                  )}
                  {waLink && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(waLink, "_blank", "noopener,noreferrer")}
                    >
                      <Send className="h-4 w-4 ml-1" /> واتساب
                    </Button>
                  )}
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    تفاصيل الفواتير ({g.invoices.length})
                  </summary>
                  <ul className="mt-2 space-y-2">{g.invoices.map(renderInvoiceLine)}</ul>
                </details>
              </div>
            );
          };

          return (
            <>
              <Card className="p-4 space-y-3">
                <h2 className="text-base font-bold">الحسابات الكلية</h2>
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : outstanding.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    لا توجد حسابات قائمة حالياً.
                  </div>
                ) : (
                  <div className="space-y-3">{outstanding.map(renderGroup)}</div>
                )}
              </Card>

              {settled.length > 0 && (
                <Card className="p-4 space-y-3">
                  <details>
                    <summary className="cursor-pointer text-base font-bold">
                      الحسابات المسددة ({settled.length})
                    </summary>
                    <div className="mt-3 space-y-3">{settled.map(renderGroup)}</div>
                  </details>
                </Card>
              )}
            </>
          );
        })()}
      </div>
    </AppShell>
  );
}
