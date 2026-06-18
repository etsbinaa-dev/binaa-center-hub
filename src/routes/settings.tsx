import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Package,
  Receipt,
  Database,
  RotateCcw,
  Download,
  Upload,
  Save,
  Trash2,
  AlertTriangle,
  Check,
  Users,
  Shield,
  Bell,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="settings" title="الإعدادات">
      <SettingsPage />
    </AppShell>
  ),
});

type AppSettings = {
  org: { name: string; phone: string; address: string };
  inventory: { criticalQuantity: number };
  invoices: { whatsappMessage: string; showSmsMessage: boolean };
};

const STORAGE_KEY = "binaa.settings";

const defaults: AppSettings = {
  org: { name: "", phone: "", address: "" },
  inventory: { criticalQuantity: 5 },
  invoices: {
    whatsappMessage:
      "مرحباً {{name}}، فاتورتكم رقم {{invoice}} من بِناء HUB جاهزة. شكراً لتعاملكم معنا.",
    showSmsMessage: true,
  },
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      org: { ...defaults.org, ...(parsed.org ?? {}) },
      inventory: { ...defaults.inventory, ...(parsed.inventory ?? {}) },
      invoices: { ...defaults.invoices, ...(parsed.invoices ?? {}) },
    };
  } catch {
    return defaults;
  }
}

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const persist = (next: AppSettings, msg = "تم الحفظ") => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setToast(msg);
  };

  const saveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    persist(settings, "تم حفظ معلومات المؤسسة");
  };
  const saveInventory = (e: React.FormEvent) => {
    e.preventDefault();
    persist(settings, "تم حفظ إعدادات المخزون");
  };
  const saveInvoices = (e: React.FormEvent) => {
    e.preventDefault();
    persist(settings, "تم حفظ إعدادات الفواتير");
  };

  // --- Backup ---
  const exportJson = async () => {
    setBusy("export");
    try {
      const [orders, invoices, customers, quantities, activity] = await Promise.all([
        supabase.from("orders").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("quantities").select("*"),
        supabase.from("activity_logs").select("*"),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        settings,
        data: {
          orders: orders.data ?? [],
          invoices: invoices.data ?? [],
          customers: customers.data ?? [],
          quantities: quantities.data ?? [],
          activity_logs: activity.data ?? [],
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `binaa-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("تم تصدير النسخة الاحتياطية");
    } catch (e: any) {
      setToast("تعذر التصدير: " + (e?.message ?? ""));
    } finally {
      setBusy(null);
    }
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("import");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.settings) {
          persist(
            {
              org: { ...defaults.org, ...(parsed.settings.org ?? {}) },
              inventory: { ...defaults.inventory, ...(parsed.settings.inventory ?? {}) },
              invoices: { ...defaults.invoices, ...(parsed.settings.invoices ?? {}) },
            },
            "تم استيراد الإعدادات من النسخة الاحتياطية",
          );
        } else {
          setToast("ملف غير صالح: لا توجد إعدادات");
        }
      } catch {
        setToast("تعذر قراءة الملف");
      } finally {
        setBusy(null);
      }
    };
    reader.readAsText(file);
  };

  // --- Reset actions ---
  const confirmAnd = async (
    msg: string,
    label: string,
    fn: () => Promise<{ error: any }>,
  ) => {
    if (!confirm(msg)) return;
    setBusy(label);
    const { error } = await fn();
    setBusy(null);
    if (error) setToast("تعذر التنفيذ: " + error.message);
    else setToast(label);
  };

  const clearActivity = () =>
    confirmAnd(
      "هل تريد فعلاً مسح سجل النشاط بالكامل؟",
      "تم مسح سجل النشاط",
      async () => await supabase.from("activity_logs").delete().not("id", "is", null),
    );

  const clearArchivedOrders = () =>
    confirmAnd(
      "حذف جميع الطلبات المؤرشفة (التي لم تُسلَّم بعد)؟",
      "تم حذف الطلبات المؤرشفة",
      async () =>
        await supabase
          .from("orders")
          .delete()
          .eq("status", "archived")
          .neq("delivery_status", "delivered"),
    );

  const clearArchivedDeliveries = () =>
    confirmAnd(
      "حذف جميع طلبات التوصيل المُسلَّمة من الأرشيف؟",
      "تم حذف أرشيف التوصيل",
      async () =>
        await supabase
          .from("orders")
          .delete()
          .eq("status", "archived")
          .eq("delivery_status", "delivered"),
    );

  if (!loaded) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        جاري التحميل…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">الإعدادات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تخصيص بيانات المؤسسة، التفضيلات، والنسخ الاحتياطي.
          </p>
        </div>
      </div>

      {/* Users management entry */}
      <Section icon={<Users className="h-5 w-5" />} title="إدارة المستخدمين">
        <p className="text-sm text-muted-foreground">
          إنشاء حسابات الفريق، تعيين الأدوار، وإدارة الصلاحيات.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/users"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Users className="h-4 w-4" />
            فتح صفحة المستخدمين
          </a>
          <a
            href="/permissions"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-bold hover:bg-muted"
          >
            <Shield className="h-4 w-4" />
            الصلاحيات
          </a>
        </div>
      </Section>

      {/* Organization */}
      <Section icon={<Building2 className="h-5 w-5" />} title="معلومات المؤسسة">
        <form onSubmit={saveOrg} className="space-y-3">
          <Field label="اسم المؤسسة">
            <input
              value={settings.org.name}
              onChange={(e) =>
                setSettings({ ...settings, org: { ...settings.org, name: e.target.value } })
              }
              className={inputCls}
              placeholder="بِناء HUB"
            />
          </Field>
          <Field label="الهاتف">
            <input
              dir="ltr"
              value={settings.org.phone}
              onChange={(e) =>
                setSettings({ ...settings, org: { ...settings.org, phone: e.target.value } })
              }
              className={inputCls}
              placeholder="+966 ..."
            />
          </Field>
          <Field label="العنوان">
            <textarea
              value={settings.org.address}
              onChange={(e) =>
                setSettings({ ...settings, org: { ...settings.org, address: e.target.value } })
              }
              rows={2}
              className={inputCls}
              placeholder="المدينة، الحي، الشارع"
            />
          </Field>
          <SaveButton />
        </form>
      </Section>

      {/* Inventory */}
      <Section icon={<Package className="h-5 w-5" />} title="إعدادات المخزون">
        <form onSubmit={saveInventory} className="space-y-3">
          <Field label="الكمية الحرجة (طن)">
            <input
              type="number"
              min={0}
              step="0.5"
              value={settings.inventory.criticalQuantity}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  inventory: {
                    ...settings.inventory,
                    criticalQuantity: Number(e.target.value) || 0,
                  },
                })
              }
              className={inputCls}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            ستُعرض المنتجات التي تساوي أو تقل عن هذا الحد كمخزون منخفض.
          </p>
          <SaveButton />
        </form>
      </Section>

      {/* Invoices */}
      <Section icon={<Receipt className="h-5 w-5" />} title="إعدادات الفواتير">
        <form onSubmit={saveInvoices} className="space-y-3">
          <Field label="رسالة واتساب الافتراضية">
            <textarea
              value={settings.invoices.whatsappMessage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  invoices: { ...settings.invoices, whatsappMessage: e.target.value },
                })
              }
              rows={3}
              className={inputCls}
            />
          </Field>
          <p className="text-[11px] text-muted-foreground">
            يمكن استخدام المتغيرات: {"{{name}}, {{invoice}}"}.
          </p>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-3 py-2.5">
            <span className="text-sm font-medium">إظهار الرسالة النصية (SMS)</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.invoices.showSmsMessage}
              onClick={() =>
                setSettings({
                  ...settings,
                  invoices: {
                    ...settings.invoices,
                    showSmsMessage: !settings.invoices.showSmsMessage,
                  },
                })
              }
              className={`relative h-6 w-11 rounded-full transition ${
                settings.invoices.showSmsMessage ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  settings.invoices.showSmsMessage ? "start-0.5" : "end-0.5"
                }`}
              />
            </button>
          </label>
          <SaveButton />
        </form>
      </Section>

      {/* Backup */}
      <Section icon={<Database className="h-5 w-5" />} title="النسخ الاحتياطي">
        <p className="mb-3 text-xs text-muted-foreground">
          تصدير جميع البيانات إلى ملف JSON أو استيراد الإعدادات من ملف سابق.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={exportJson}
            disabled={busy === "export"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {busy === "export" ? "جاري التصدير…" : "تصدير البيانات (JSON)"}
          </button>
          <label
            className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:bg-muted ${
              busy === "import" ? "opacity-60" : ""
            }`}
          >
            <Upload className="h-4 w-4" />
            {busy === "import" ? "جاري الاستيراد…" : "استيراد من ملف JSON"}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importJson}
              disabled={busy === "import"}
            />
          </label>
        </div>
      </Section>

      {/* Reset */}
      <Section
        icon={<RotateCcw className="h-5 w-5" />}
        title="إعادة الضبط"
        danger
      >
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>هذه العمليات لا يمكن التراجع عنها. تأكد قبل المتابعة.</span>
        </div>
        <div className="space-y-2">
          <DangerButton
            label="مسح سجل النشاط"
            busy={busy === "تم مسح سجل النشاط"}
            onClick={clearActivity}
          />
          <DangerButton
            label="مسح أرشيف الطلبات"
            busy={busy === "تم حذف الطلبات المؤرشفة"}
            onClick={clearArchivedOrders}
          />
          <DangerButton
            label="مسح أرشيف التوصيل"
            busy={busy === "تم حذف أرشيف التوصيل"}
            onClick={clearArchivedDeliveries}
          />
        </div>
      </Section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-lg">
          <Check className="h-4 w-4" />
          {toast}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Section({
  icon,
  title,
  danger,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-card p-5 shadow-sm ${
        danger ? "border-destructive/30" : "border-border"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </span>
        <h3 className="text-base font-extrabold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveButton() {
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
    >
      <Save className="h-4 w-4" />
      حفظ
    </button>
  );
}

function DangerButton({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
    >
      <span className="inline-flex items-center gap-2">
        <Trash2 className="h-4 w-4" />
        {label}
      </span>
      <span className="text-[11px] font-normal opacity-70">حذف</span>
    </button>
  );
}
