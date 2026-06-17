import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  ClipboardList,
  Receipt,
  Truck,
  Package,
  User,
  Users,
  BarChart3,
  Activity,
  Settings,
  Menu,
  X,
  Building2,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  RoleContext,
  ROLES,
  canAccess,
  type ModuleKey,
  type Role,
} from "@/lib/roles";

type NavItem = {
  key: ModuleKey;
  label: string;
  to: string;
  icon: typeof Home;
};

const NAV: NavItem[] = [
  { key: "home", label: "الرئيسية", to: "/", icon: Home },
  { key: "orders", label: "الطلبات", to: "/orders", icon: ClipboardList },
  { key: "invoices", label: "الفواتير", to: "/invoices", icon: Receipt },
  { key: "delivery", label: "التوصيل", to: "/delivery", icon: Truck },
  { key: "inventory", label: "الكميات", to: "/inventory", icon: Package },
  { key: "customers", label: "العملاء", to: "/customers", icon: User },
  { key: "users", label: "المستخدمون", to: "/users", icon: Users },
  { key: "reports", label: "التقارير", to: "/reports", icon: BarChart3 },
  { key: "settings", label: "سجل النشاط", to: "/activity", icon: Activity },
  { key: "settings", label: "الإعدادات", to: "/settings", icon: Settings },
];

export function AppShell({
  moduleKey,
  title,
  children,
}: {
  moduleKey: ModuleKey;
  title: string;
  children: ReactNode;
}) {
  const [role, setRoleState] = useState<Role>("admin");
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("binaa.role")) as Role | null;
    if (stored) setRoleState(stored);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") localStorage.setItem("binaa.role", r);
  };

  useEffect(() => setMobileOpen(false), [pathname]);

  const allowed = canAccess(role, moduleKey);
  const items = NAV.filter((n) => canAccess(role, n.key));

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      <div dir="rtl" className="flex min-h-screen w-full bg-background text-foreground">
        {/* Sidebar — desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
          <SidebarBrand />
          <NavList items={items} pathname={pathname} />
          <RoleBadge role={role} />
        </aside>

        {/* Sidebar — mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute right-0 top-0 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground shadow-2xl">
              <div className="flex items-center justify-between px-4 pt-4">
                <SidebarBrand compact />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-2 hover:bg-sidebar-accent"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList items={items} pathname={pathname} />
              <RoleBadge role={role} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 hover:bg-muted lg:hidden"
              aria-label="القائمة"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="min-w-0 truncate text-lg font-bold sm:text-xl">{title}</h1>
            <div className="ms-auto flex items-center gap-2">
              <NotificationsBell />
              <AuthControls />
              <RoleSelect role={role} setRole={setRole} />
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {allowed ? (
              children
            ) : (
              <AccessDenied />
            )}
          </main>
        </div>
      </div>
    </RoleContext.Provider>
  );
}

function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-5 ${compact ? "py-2" : "py-6"}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-extrabold tracking-tight">بِناء HUB</div>
        <div className="truncate text-xs text-sidebar-foreground/60">منصة الأعمال المركزية</div>
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const label = ROLES.find((r) => r.value === role)?.label;
  return (
    <div className="m-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs">
      <div className="text-sidebar-foreground/60">الدور الحالي</div>
      <div className="mt-1 font-semibold text-sidebar-foreground">{label}</div>
    </div>
  );
}

function RoleSelect({
  role,
  setRole,
}: {
  role: Role;
  setRole: (r: Role) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs sm:text-sm">
      <span className="hidden text-muted-foreground sm:inline">الدور:</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AccessDenied() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <X className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold">لا تملك صلاحية الوصول</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        هذه الوحدة غير متاحة لدورك الحالي. تواصل مع مدير النظام للحصول على الصلاحية.
      </p>
    </div>
  );
}

function AuthControls() {
  const { user, signOut, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">تسجيل الدخول</span>
      </Link>
    );
  }
  return (
    <button
      onClick={() => signOut()}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
      aria-label="تسجيل الخروج"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">خروج</span>
    </button>
  );
}

