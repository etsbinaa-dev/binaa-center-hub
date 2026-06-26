import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Receipt,
  Truck,
  Inbox,
  Wallet,
  AlertTriangle,
  PackageX,
  Clock,
  PlusCircle,
  FileText,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OrderDialog } from "@/components/orders-list";
import { Dialog } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الرئيسية — بِناء HUB" },
      { name: "description", content: "لوحة التحكم اليومية لمنصة بِناء HUB." },
    ],
  }),
  component: HomePage,
});

const HOUSE_SIGN: Record<string, 1 | -1> = {
  central_to_house: 1,
  add_cash: 1,
  house_to_bank: -1,
  house_to_central: -1,
  withdraw_cash: -1,
};

type Stats = {
  activeOrders: number;
  unsentInvoices: number;
  inProgressDeliveries: number;
  houseBalance: number;
  todayReceptions: number;
  lowStock: number;
  overdueAccounts: number;
  pendingTempEntries: number;
};

function HomePage() {
  return (
    <AppShell moduleKey="home" title="الرئيسية">
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const role = useRole().role;
  const isDelivery = role === "delivery";
  const [stats, setStats] = useState<Stats | null>(null);
  const [showOrder, setShowOrder] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const iso = startOfDay.toISOString();

      const [
        ordersActive,
        invoicesNew,
        deliveriesActive,
        houseOps,
        receptionsToday,
        quantities,
        reminders,
        tempPending,
      ] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).neq("status", "archived"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("delivery_status", ["new", "in_progress"]),
        supabase.from("house_cash_ops").select("op_type, amount"),
        supabase
          .from("receptions")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .gte("created_at", iso),
        supabase.from("quantities").select("quantity"),
        supabase.from("account_reminders").select("id", { count: "exact", head: true }).neq("status", "paid"),
        supabase.from("temp_entries").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const threshold = await supabase
        .from("app_settings")
        .select("critical_quantity")
        .eq("id", 1)
        .maybeSingle();
      const critQty =
        (threshold.data as { critical_quantity?: number } | null)?.critical_quantity ?? 5;

      const balance = (houseOps.data ?? []).reduce(
        (acc: number, r: { op_type: string; amount: number | string }) =>
          acc + (HOUSE_SIGN[r.op_type] ?? 0) * (Number(r.amount) || 0),
        0,
      );

      const lowStock = (quantities.data ?? []).filter(
        (q: { quantity: number }) => (q.quantity ?? 0) <= critQty,
      ).length;

      if (!alive) return;
      setStats({
        activeOrders: ordersActive.count ?? 0,
        unsentInvoices: invoicesNew.count ?? 0,
        inProgressDeliveries: deliveriesActive.count ?? 0,
        houseBalance: balance,
        todayReceptions: receptionsToday.count ?? 0,
        lowStock,
        overdueAccounts: reminders.count ?? 0,
        pendingTempEntries: tempPending.count ?? 0,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fmt = (n: number) => n.toLocaleString("ar-DZ");
  const fmtMoney = (n: number) =>
    n.toLocaleString("ar-DZ", { maximumFractionDigits: 2 }) + " MRO";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-bl from-primary to-primary/70 p-6 text-primary-foreground sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          لوحة التحكم اليومية
        </div>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">
          مرحباً بك في <span className="text-accent">بِناء HUB</span>
        </h2>
        <p className="mt-2 text-sm text-primary-foreground/80">
          نظرة سريعة على نشاط اليوم والتنبيهات الهامة.
        </p>
      </section>

      {/* بطاقة طلب جديد بارزة */}
      {!isDelivery && (
        <section>
          <button
            type="button"
            onClick={() => setShowOrder(true)}
            className="group flex w-full items-center gap-4 rounded-3xl border-2 border-primary/30 bg-gradient-to-l from-primary to-primary/80 p-5 text-right text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-xl sm:gap-6 sm:p-6"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur transition-transform group-hover:scale-110 sm:h-16 sm:w-16">
              <Plus className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold sm:text-xl">طلب جديد</div>
              <div className="mt-1 text-sm text-primary-foreground/85">
                إنشاء طلب جديد للعميل بسرعة
              </div>
            </div>
          </button>
        </section>
      )}

      {/* القسم 1: ملخص اليوم */}
      <section>
        <h3 className="mb-3 text-lg font-bold">ملخص اليوم</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={ClipboardList} label="طلبات نشطة" value={stats ? fmt(stats.activeOrders) : "…"} to="/orders" />
          {!isDelivery && (
            <StatCard icon={Receipt} label="فواتير غير مرسلة" value={stats ? fmt(stats.unsentInvoices) : "…"} to="/invoices" />
          )}
          <StatCard icon={Truck} label="توصيلات قيد التنفيذ" value={stats ? fmt(stats.inProgressDeliveries) : "…"} to="/delivery" />
          {!isDelivery && (
            <StatCard icon={Wallet} label="رصيد كيص الدار" value={stats ? fmtMoney(stats.houseBalance) : "…"} accent to="/daily-payments" />
          )}
          <StatCard icon={Inbox} label="مدخلات استقبال اليوم" value={stats ? fmt(stats.todayReceptions) : "…"} to="/reception" />
        </div>
      </section>

      {/* القسم 2: تنبيهات */}
      {!isDelivery && stats && (stats.lowStock > 0 || stats.overdueAccounts > 0 || stats.pendingTempEntries > 0) && (
        <section>
          <h3 className="mb-3 text-lg font-bold">تنبيهات فورية</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.lowStock > 0 && (
              <AlertCard
                tone="danger"
                icon={PackageX}
                title="مخزون حرج"
                value={`${fmt(stats.lowStock)} منتج`}
                to="/inventory"
                search={{ filter: "critical" }}
                cta="عرض المخزون"
              />
            )}
            {stats.overdueAccounts > 0 && (
              <AlertCard
                tone="warning"
                icon={AlertTriangle}
                title="حسابات متأخرة غير محصلة"
                value={`${fmt(stats.overdueAccounts)} حساب`}
                to="/accounts-followup"
                cta="متابعة الحسابات"
              />
            )}
            {stats.pendingTempEntries > 0 && (
              <AlertCard
                tone="warning"
                icon={Clock}
                title="قيود مؤقتة غير معالجة"
                value={`${fmt(stats.pendingTempEntries)} قيد`}
                to="/daily-payments"
                cta="مراجعة القيود"
              />
            )}
          </div>
        </section>
      )}


      {/* القسم 3: وصول سريع */}
      <section>
        <h3 className="mb-3 text-lg font-bold">وصول سريع</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction icon={ClipboardList} label="طلب جديد" to="/orders" />
          <QuickAction icon={Inbox} label="استقبال جديد" to="/reception" />
          <QuickAction icon={PlusCircle} label="قيد جديد" to="/daily-payments" />
          <QuickAction icon={FileText} label="فرز فاتورة" to="/invoices" />
        </div>
      </section>
      {showOrder && (
        <OrderDialog onDone={() => setShowOrder(false)} />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-2 text-xl font-extrabold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </Link>
  );
}

function AlertCard({
  icon: Icon,
  title,
  value,
  to,
  cta,
  tone,
  search,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  to: string;
  cta: string;
  tone: "warning" | "danger";
  search?: Record<string, string>;
}) {
  const styles =
    tone === "danger"
      ? "border-red-300 bg-red-50 text-red-900"
      : "border-amber-300 bg-amber-50 text-amber-900";
  const btn =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-amber-600 text-white hover:bg-amber-700";
  return (
    <Link
      to={to}
      search={search as never}
      className={`block rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${styles}`}
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon className="h-5 w-5" />
        {title}
      </div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <span
        className={`mt-3 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold transition ${btn}`}
      >
        {cta}
      </span>
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-lg"
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-white/20 group-hover:text-primary-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-sm font-bold">{label}</div>
    </Link>
  );
}
