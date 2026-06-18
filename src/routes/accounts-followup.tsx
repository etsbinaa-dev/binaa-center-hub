import { createFileRoute } from "@tanstack/react-router";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
    reload();
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

        {/* Major invoices list */}
        <Card className="p-4 space-y-3">
          <h2 className="text-base font-bold">الحسابات الكبيرة</h2>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد فواتير تتجاوز الحد الحالي.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => {
                try {
                  const history = remindersByInvoice[inv.id] ?? [];
                  const currentAmount = safeNum(inv.amount);
                  return (
                    <div key={inv.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{inv.customer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground" dir="ltr">
                            {inv.customer_phone || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            فاتورة {inv.invoice_number || "—"} · {safeFormatDate(inv.created_at)}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            inv.payment_status === "paid"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                          }`}
                        >
                          {inv.payment_status === "paid" ? "مدفوعة" : "غير مدفوعة"}
                        </span>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">المبلغ</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={amountDraft[inv.id] ?? (inv.amount == null ? "" : String(currentAmount))}
                            onChange={(e) =>
                              setAmountDraft((d) => ({ ...d, [inv.id]: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const raw = amountDraft[inv.id] ?? (inv.amount == null ? "" : String(currentAmount));
                            const num = raw === "" ? null : Number(raw);
                            if (num !== null && (!Number.isFinite(num) || num < 0)) {
                              toast.error("مبلغ غير صالح");
                              return;
                            }
                            await saveAmount({ data: { invoice_id: inv.id, amount: num } });
                            toast.success("تم حفظ المبلغ");
                            reload();
                          }}
                        >
                          حفظ
                        </Button>
                      </div>
                      {history.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            سجل التذكيرات ({history.length})
                          </summary>
                          <ul className="mt-2 space-y-1">
                            {history.map((h) => {
                              try {
                                return (
                                  <li key={h.id} className="rounded border bg-muted/30 p-2">
                                    <div className="font-mono text-[10px] text-muted-foreground">
                                      {safeFormatDateTime(h.created_at)}
                                    </div>
                                    <div>
                                      الحالة:{" "}
                                      {h.status === "paid"
                                        ? "مدفوعة"
                                        : h.status === "not_paid"
                                          ? "غير مدفوعة"
                                          : h.status === "snoozed"
                                            ? "ذكّرني لاحقاً"
                                            : "بانتظار الرد"}
                                    </div>
                                    {h.next_remind_at && (
                                      <div className="text-muted-foreground">
                                        التذكير التالي: {safeFormatDateTime(h.next_remind_at)}
                                      </div>
                                    )}
                                  </li>
                                );
                              } catch (err) {
                                console.error("[followup] failed to render reminder history row", h, err);
                                return null;
                              }
                            })}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                } catch (err) {
                  console.error("[followup] failed to render invoice row", inv, err);
                  return null;
                }
              })}

            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
