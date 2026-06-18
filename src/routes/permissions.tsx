import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, Save, Check, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  MODULES,
  ROLES_LIST,
  PERMS,
  usePermissions,
  type Permission,
  type PermissionMatrix,
} from "@/hooks/use-permissions";
import { type ModuleKey, type Role } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/permissions")({
  head: () => ({ meta: [{ title: "الصلاحيات — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="settings" title="الصلاحيات">
      <PermissionsPage />
    </AppShell>
  ),
});

const ROLE_LABELS: Record<Role, string> = {
  admin: "المدير",
  accountant: "المحاسب",
  delivery: "مسؤول التوصيل",
  monitor: "المراقب",
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  home: "لوحة التحكم",
  orders: "الطلبات",
  invoices: "الفواتير",
  delivery: "التوصيل",
  inventory: "الكميات",
  customers: "العملاء",
  users: "المستخدمون",
  reports: "التقارير",
  accounts_followup: "متابعة الدفع",
  settings: "الإعدادات",
};

const PERM_LABELS: Record<Permission, string> = {
  view: "عرض",
  create: "إنشاء",
  edit: "تعديل",
  delete: "حذف",
};

function PermissionsPage() {
  const { role: authRole } = useAuth();
  const { matrix, loaded, refresh } = usePermissions();
  const [draft, setDraft] = useState<PermissionMatrix | null>(null);
  const [activeRole, setActiveRole] = useState<Role>("accountant");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = authRole === "admin";


  useEffect(() => {
    if (loaded && !draft) {
      setDraft(JSON.parse(JSON.stringify(matrix)));
    }
  }, [loaded, matrix, draft]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = useMemo(
    () => draft && JSON.stringify(draft) !== JSON.stringify(matrix),
    [draft, matrix],
  );

  const toggle = (role: Role, mod: ModuleKey, perm: Permission) => {
    if (!draft) return;
    const next: PermissionMatrix = JSON.parse(JSON.stringify(draft));
    next[role][mod][perm] = !next[role][mod][perm];
    // If view is turned off, also turn off other perms for that module/role.
    if (perm === "view" && !next[role][mod].view) {
      next[role][mod].create = false;
      next[role][mod].edit = false;
      next[role][mod].delete = false;
    }
    setDraft(next);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const rows: Array<{ role: Role; module: string; permission: Permission; allowed: boolean }> = [];
    for (const r of ROLES_LIST) {
      for (const m of MODULES) {
        for (const p of PERMS) {
          rows.push({ role: r, module: m, permission: p, allowed: draft[r][m][p] });
        }
      }
    }
    const { error } = await (supabase as any).from("role_permissions").upsert(rows, {
      onConflict: "role,module,permission",
    });
    setSaving(false);
    if (error) {
      setToast("تعذر الحفظ: " + error.message);
      return;
    }
    await refresh();
    setToast("تم حفظ الصلاحيات");
  };

  if (!loaded || !draft) {
    return <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              عودة للإعدادات
            </Link>
          </div>
          <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">إدارة الصلاحيات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تحكّم بصلاحيات كل دور (عرض / إنشاء / تعديل / حذف) لكل قسم. تُطبّق فور حفظها.
          </p>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex flex-wrap gap-2">
        {ROLES_LIST.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRole(r)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              activeRole === r
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Permissions table */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 ps-2 text-start font-bold">القسم</th>
                {PERMS.map((p) => (
                  <th key={p} className="px-2 py-2 text-center font-bold">
                    {PERM_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 ps-2 font-medium">{MODULE_LABELS[m]}</td>
                  {PERMS.map((p) => {
                    const checked = draft[activeRole][m][p];
                    return (
                      <td key={p} className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(activeRole, m, p)}
                          className="h-5 w-5 cursor-pointer rounded border-border accent-primary"
                          aria-label={`${MODULE_LABELS[m]} - ${PERM_LABELS[p]}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ملاحظة: إيقاف صلاحية «عرض» لقسم ما يُخفيه عن المستخدمين الذين يحملون هذا الدور.
        </p>
      </section>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {dirty ? "لديك تغييرات غير محفوظة" : "كل الصلاحيات محفوظة"}
          </span>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ…" : "حفظ الصلاحيات"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-lg">
          <Check className="h-4 w-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
