import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Users as UsersIcon,
  Plus,
  Trash2,
  Pencil,
  Mail,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ROLES, type Role } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from "@/lib/admin-users.functions";
import { logActivity } from "@/lib/activity";

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
  email: string | undefined;
  full_name: string | null;
  role: Role;
  created_at: string;
};

type FormState = {
  id?: string;
  email: string;
  full_name: string;
  password: string;
  role: Role;
};

const emptyForm: FormState = { email: "", full_name: "", password: "", role: "accountant" };

const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-primary/10 text-primary",
  accountant: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delivery: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  monitor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function UsersPage() {
  const router = useRouter();
  const { user: me } = useAuth();
  const fnList = useServerFn(listUsers);
  const fnCreate = useServerFn(createUser);
  const fnUpdate = useServerFn(updateUser);
  const fnDelete = useServerFn(deleteUser);
  const fnReset = useServerFn(resetUserPassword);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fnList();
      setUsers(data as AppUser[]);
    } catch (e: any) {
      setError(e?.message ?? "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const openAdd = () => { setForm(emptyForm); setShowPwd(false); setOpen(true); };
  const openEdit = (u: AppUser) => {
    setForm({ id: u.id, email: u.email ?? "", full_name: u.full_name ?? "", password: "", role: u.role });
    setShowPwd(false); setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.full_name.trim()) return;
    if (!form.id && !form.password.trim()) return;
    setSaving(true);
    try {
      if (form.id) {
        await fnUpdate({ data: {
          user_id: form.id,
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          role: form.role,
        }});
        setToast("تم تحديث المستخدم");
        logActivity({ module: "users", action: "update", description: `تعديل المستخدم ${form.full_name}` });
      } else {
        await fnCreate({ data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          role: form.role,
        }});
        setToast("تم إضافة المستخدم");
        logActivity({ module: "users", action: "create", description: `إضافة المستخدم ${form.full_name}` });
      }
      setOpen(false);
      await load();
      router.invalidate();
    } catch (e: any) {
      setError(e?.message ?? "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: AppUser) => {
    if (u.id === me?.id) { setError("لا يمكنك حذف حسابك الحالي."); return; }
    if (!confirm(`حذف المستخدم "${u.full_name ?? u.email}"؟`)) return;
    try {
      await fnDelete({ data: { user_id: u.id } });
      setToast("تم حذف المستخدم");
      logActivity({ module: "users", action: "delete", description: `حذف المستخدم ${u.full_name ?? u.email ?? u.id}` });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "تعذّر الحذف");
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPwd.length < 6) { setError("كلمة المرور يجب ألا تقل عن 6 أحرف"); return; }
    setResetBusy(true);
    try {
      await fnReset({ data: { user_id: resetTarget.id, password: resetPwd } });
      setToast(`تم إعادة تعيين كلمة المرور لـ ${resetTarget.full_name ?? resetTarget.email}`);
      logActivity({ module: "users", action: "reset_password", description: `إعادة تعيين كلمة مرور ${resetTarget.full_name ?? resetTarget.email}` });
      setResetTarget(null); setResetPwd("");
    } catch (e: any) {
      setError(e?.message ?? "تعذّر إعادة التعيين");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <UsersIcon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-extrabold sm:text-2xl">إدارة المستخدمين</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أنشئ حسابات الفريق وعيّن الأدوار وأعد ضبط كلمات المرور.
          </p>
        </div>
      </div>

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

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          لا يوجد مستخدمون بعد. اضغط "إضافة مستخدم" للبدء.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <article key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold">{u.full_name ?? "—"}</h3>
                      {isMe && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">أنت</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span dir="ltr" className="truncate">{u.email}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${roleBadgeClass[u.role]}`}>
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
                    onClick={() => { setResetTarget(u); setResetPwd(""); }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    كلمة المرور
                  </button>
                  <button
                    onClick={() => remove(u)}
                    disabled={isMe}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={save}
            className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{form.id ? "تعديل مستخدم" : "إضافة مستخدم"}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">الاسم الكامل</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني</label>
              <input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {!form.id && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    dir="ltr"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={6}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pe-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute inset-y-0 end-2 grid place-items-center text-muted-foreground"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">الدور</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {ROLES.find((r) => r.value === form.role)?.description}
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? "حفظ التعديلات" : "إنشاء المستخدم"}
            </button>
          </form>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setResetTarget(null)}
        >
          <form
            onSubmit={submitReset}
            className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">إعادة تعيين كلمة المرور</h3>
              <button type="button" onClick={() => setResetTarget(null)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              المستخدم: <span className="font-bold text-foreground">{resetTarget.full_name ?? resetTarget.email}</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">كلمة مرور جديدة</label>
              <input
                type="text"
                dir="ltr"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                minLength={6}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={resetBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {resetBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد
            </button>
          </form>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
