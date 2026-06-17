import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Trash2, ShieldCheck, Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ROLES, MODULE_ACCESS, type Role, type ModuleKey } from "@/lib/roles";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "المستخدمون — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="users" title="المستخدمون">
      <UsersPage />
    </AppShell>
  ),
});

type AppUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
};

const STORAGE_KEY = "binaa.users";

const MODULE_LABELS: Record<ModuleKey, string> = {
  home: "الرئيسية",
  orders: "الطلبات",
  invoices: "الفواتير",
  delivery: "التوصيل",
  inventory: "المخزون",
  customers: "العملاء",
  users: "المستخدمون",
  reports: "التقارير",
  settings: "الإعدادات",
};

function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; role: Role }>({
    name: "",
    phone: "",
    role: "accountant",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUsers(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }, [users, loaded]);

  const addUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setUsers((u) => [
      ...u,
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
      },
    ]);
    setForm({ name: "", phone: "", role: "accountant" });
  };

  const removeUser = (id: string) =>
    setUsers((u) => u.filter((x) => x.id !== id));

  const updateRole = (id: string, role: Role) =>
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, role } : x)));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">إدارة المستخدمين</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف أعضاء الفريق وعيّن لكل واحد منهم أحد الأدوار الثلاثة المعتمدة.
          </p>
        </div>
      </div>

      {/* Roles overview */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold sm:text-lg">الأدوار المعتمدة</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ROLES.map((r) => (
            <div
              key={r.value}
              className="rounded-xl border border-border bg-background/50 p-4"
            >
              <div className="text-sm font-bold">{r.label}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {r.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Permissions matrix */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="mb-4 text-base font-bold sm:text-lg">مصفوفة الصلاحيات</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted-foreground">
                <th className="py-2 pe-3 font-medium">الوحدة</th>
                {ROLES.map((r) => (
                  <th key={r.value} className="px-3 py-2 text-center font-medium">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(MODULE_ACCESS) as ModuleKey[]).map((m) => (
                <tr key={m} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pe-3 font-medium">{MODULE_LABELS[m]}</td>
                  {ROLES.map((r) => {
                    const allowed = MODULE_ACCESS[m].includes(r.value);
                    return (
                      <td key={r.value} className="px-3 py-2.5 text-center">
                        {allowed ? (
                          <Check className="mx-auto h-4 w-4 text-primary" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add user */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="mb-4 text-base font-bold sm:text-lg">إضافة مستخدم</h3>
        <form
          onSubmit={addUser}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_180px_auto]"
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="الاسم الكامل"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="رقم الهاتف"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة
          </button>
        </form>
      </section>

      {/* Users list */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold sm:text-lg">قائمة المستخدمين</h3>
          <span className="text-xs text-muted-foreground">
            {users.length} مستخدم
          </span>
        </div>
        {users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            لا يوجد مستخدمون بعد. ابدأ بإضافة أول مستخدم من النموذج أعلاه.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">الاسم</th>
                  <th className="px-3 py-2 font-medium">الهاتف</th>
                  <th className="px-3 py-2 font-medium">الدور</th>
                  <th className="ps-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pe-3 font-medium">{u.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {u.phone || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value as Role)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="ps-3 py-3 text-end">
                      <button
                        onClick={() => removeUser(u.id)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
