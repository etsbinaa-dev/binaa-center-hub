import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Receipt,
  Truck,
  Package,
  User,
  Users,
  Settings,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { canAccess, useRole, type ModuleKey } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الرئيسية — بِناء HUB" },
      { name: "description", content: "لوحة التحكم الرئيسية لمنصة بِناء HUB." },
    ],
  }),
  component: HomePage,
});

type Tile = {
  key: ModuleKey;
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const TILES: Tile[] = [
  { key: "orders", to: "/orders", label: "الطلبات", description: "إدارة وتتبع طلبات العملاء.", icon: ClipboardList },
  { key: "invoices", to: "/invoices", label: "فرز وإرسال", description: "استخراج بيانات الفواتير بـ OCR وإرسالها للعملاء عبر واتساب.", icon: Receipt },
  { key: "delivery", to: "/delivery", label: "التوصيل", description: "جدولة الشحنات ومتابعة السائقين.", icon: Truck },
  { key: "inventory", to: "/inventory", label: "المخزون", description: "متابعة الأصناف والمستودعات.", icon: Package },
  { key: "customers", to: "/customers", label: "العملاء", description: "قاعدة بيانات العملاء وحساباتهم.", icon: User },
  { key: "users", to: "/users", label: "المستخدمون", description: "الموظفون والصلاحيات والأدوار.", icon: Users },
  { key: "settings", to: "/settings", label: "الإعدادات", description: "تفضيلات النظام والمؤسسة.", icon: Settings },
];

function HomePage() {
  return (
    <AppShell moduleKey="home" title="الرئيسية">
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const { role } = useRole();
  const tiles = TILES.filter((t) => canAccess(role, t.key));

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-bl from-primary to-primary/70 p-6 text-primary-foreground sm:p-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            منصة الأعمال المركزية
          </div>
          <h2 className="mt-4 text-2xl font-extrabold leading-tight sm:text-4xl">
            مرحباً بك في <span className="text-accent">بِناء HUB</span>
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/80 sm:text-base">
            مركز موحّد لإدارة كل عمليات BINA'A — الطلبات، الفواتير، التوصيل، المخزون، والتقارير في مكان واحد.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h3 className="text-lg font-bold sm:text-xl">الوحدات المتاحة لك</h3>
          <span className="text-xs text-muted-foreground">{tiles.length} وحدة</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.key}
                to={t.to}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-bold">{t.label}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
