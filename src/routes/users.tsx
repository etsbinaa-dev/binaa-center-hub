import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  Power,
  Phone,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ROLES, type Role } from "@/lib/roles";

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
  password: string;
  role: Role;
  active: boolean;
};

type FormState = {
  id?: string;
  name: string;
  phone: string;
  password: string;
  role: Role;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  password: "",
  role: "accountant",
  active: true,
};

const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-primary/10 text-primary",
  accountant: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delivery: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  monitor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("app_users")
      .select("id,name,phone,password,role,active")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setUsers((data ?? []) as AppUser[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const openAdd = () => {
    setForm(emptyForm);
    setShowPwd(false);
    setOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setForm({
      id: u.id,
      name: u.name,
      phone: u.phone,
      password: u.password,
      role: u.role,
      active: u.active,
    });
    setShowPwd(false);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      password: form.password,
      role: form.role,
      active: form.active,
    };
    const { error } = form.id
      ? await supabase.from("app_users").update(payload).eq("id", form.id)
      : await supabase.from("app_users").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOpen(false);
    setToast(form.id ? "تم تحديث المستخدم" : "تم إضافة المستخدم");
    load();
  };

  const toggleActive = async (u: AppUser) => {
    const { error } = await supabase
      .from("app_users")
      .update({ active: !u.active })
      .eq("id", u.id);
    if (error) {
      setError(error.message);
      return;
    }
    setToast(!u.active ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم");
    load();
  };

  const remove = async (u: AppUser) => {
    if (!confirm(`حذف المستخدم "${u.name}"؟`)) return;
    const { error } = await supabase.from("app_users").delete().eq("id", u.id);
    if (error) {
      setError(error.message);
      return;
    }
    setToast("تم حذف المستخدم");
    load();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-extrabold sm:text-2xl">إدارة المستخدمين</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف أعضاء الفريق وعيّن لكل واحد دوره وحالته.
          </p>
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={openAdd}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        <Plus className="h-5 w-5" />
        إضافة مستخدم
      </button>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          جاري التحميل…
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          لا يوجد مستخدمون بعد. اضغط "إضافة مستخدم" للبدء.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <article
              key={u.id}
              className={`rounded-2xl border bg-card p-4 shadow-sm transition ${
                u.active ? "border-border" : "border-border/60 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-bold">{u.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        u.active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.active ? "نشط" : "معطل"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span dir="ltr">{u.phone}</span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${roleBadgeClass[u.role]}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {roleLabel(u.role)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={() => openEdit(u)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
                    u.active
                      ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                      : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {u.active ? "تعطيل" : "تفعيل"}
                </button>
                <button
                  onClick={() => remove(u)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {form.id ? "تعديل مستخدم" : "إضافة مستخدم"}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">
                  الاسم
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">
                  رقم الهاتف
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute inset-y-0 end-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    aria-label={showPwd ? "إخفاء" : "إظهار"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">
                  الدور
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">
                  الحالة
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: true })}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                      form.active
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-input bg-background text-muted-foreground"
                    }`}
                  >
                    نشط
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: false })}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                      !form.active
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-input bg-background text-muted-foreground"
                    }`}
                  >
                    معطل
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "جاري الحفظ…" : form.id ? "حفظ التعديلات" : "إضافة المستخدم"}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
