import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Save, RefreshCcw, CheckCircle2, XCircle, Clock } from "lucide-react";
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
  head: () => ({ meta: [{ title: "متابعة الحسابات — بِناء HUB" }] }),
  component: AccountsFollowupPage,
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
      (m[r.invoice_id] ||= []).push(r);
    }
    return m;
  }, [reminders]);

  async function reload() {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([fetchSettings(), fetchList()]);
      setSettings({
        threshold_amount: Number(s.threshold_amount),
        initial_delay_days: Number(s.initial_delay_days),
        snooze_days: Number(s.snooze_days),
      });
      setInvoices(l.invoices as Invoice[]);
      setReminders(l.reminders as Reminder[]);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell moduleKey="accounts_followup" title="متابعة الحسابات">
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
                  const inv = invoices.find((i) => i.id === r.invoice_id);
                  return (
                    <div key={r.id} className="rounded-lg border p-3 space-y-2">
                      <div className="text-sm font-semibold">{r.message}</div>
                      {inv && (
                        <div className="text-xs text-muted-foreground">
                          فاتورة {inv.invoice_number} · {inv.customer_phone} ·{" "}
                          {inv.amount != null ? `${inv.amount}` : "—"}
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
                      </div>
                    </div>
                  );
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
                const history = remindersByInvoice[inv.id] ?? [];
                return (
                  <div key={inv.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{inv.customer_name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {inv.customer_phone}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          فاتورة {inv.invoice_number} · {new Date(inv.created_at).toLocaleDateString("ar")}
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
                          value={amountDraft[inv.id] ?? (inv.amount?.toString() ?? "")}
                          onChange={(e) =>
                            setAmountDraft((d) => ({ ...d, [inv.id]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const raw = amountDraft[inv.id] ?? (inv.amount?.toString() ?? "");
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
                          {history.map((h) => (
                            <li key={h.id} className="rounded border bg-muted/30 p-2">
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {new Date(h.created_at).toLocaleString("ar")}
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
                                  التذكير التالي: {new Date(h.next_remind_at).toLocaleString("ar")}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
