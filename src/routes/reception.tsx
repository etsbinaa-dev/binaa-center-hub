import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Inbox, Plus, RefreshCw, Archive, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notifyReceptionCreated } from "@/lib/reception-notify.functions";

export const Route = createFileRoute("/reception")({
  head: () => ({ meta: [{ title: "الاستقبال — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="reception" title="الاستقبال">
      <RequireAuth>
        <ReceptionPage />
      </RequireAuth>
    </AppShell>
  ),
});

type Unit = "طن" | "قطعة";
type Row = {
  id: string;
  supplier: string;
  goods_type: string;
  quantity: number;
  unit: Unit;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  is_archived: boolean;
};

type TabKind = "active" | "archive";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function formatAmount(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR").format(n);
  } catch {
    return String(n);
  }
}
function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function ReceptionPage() {
  const { user } = useAuth();
  const userName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || "مستخدم";
  const userId = user?.id ?? null;

  const [tab, setTab] = useState<TabKind>("active");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("receptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) console.error("[receptions:load]", error);
      setRows((data ?? []) as Row[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const active = useMemo(() => rows.filter((r) => !r.is_archived), [rows]);
  const archived = useMemo(() => rows.filter((r) => r.is_archived), [rows]);

  const archive = async (id: string) => {
    const { error } = await (supabase as any)
      .from("receptions")
      .update({ is_archived: true })
      .eq("id", id);
    if (error) return setToast("تعذرت الأرشفة: " + error.message);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, is_archived: true } : r)));
    setToast("تمت الأرشفة");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا السجل؟")) return;
    const { error } = await (supabase as any).from("receptions").delete().eq("id", id);
    if (error) return setToast("تعذر الحذف: " + error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
    setToast("تم الحذف");
  };

  const update = async (id: string, payload: Partial<Row>) => {
    const { error } = await (supabase as any)
      .from("receptions")
      .update(payload)
      .eq("id", id);
    if (error) return setToast("تعذر التعديل: " + error.message);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    setToast("تم التعديل بنجاح");
    setEditRow(null);
  };


  const list = tab === "active" ? active : archived;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">📥 الاستقبال</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              تسجيل وارد البضائع من الموردين ومتابعتها.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
          aria-label="تحديث"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { k: "active", label: "📦 المدخلات النشطة" },
          { k: "archive", label: "🗂️ الأرشيف" },
        ] as const).map((f) => (
          <button
            key={f.k}
            onClick={() => setTab(f.k)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              tab === f.k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tab === "active" ? (
        <div className="flex justify-end">
          <button
            onClick={() => setOpenForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> سجل جديد
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {tab === "active" ? "لا توجد مدخلات نشطة." : "الأرشيف فارغ."}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      🏭 {r.supplier}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {r.goods_type}
                    </span>
                    {r.is_archived ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <Archive className="h-3 w-3" /> مؤرشف
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-primary">
                    {formatAmount(Number(r.quantity) || 0)} {r.unit}
                  </div>
                  {r.notes ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {r.notes}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>🕒 {formatDateTime(r.created_at)}</span>
                    {r.created_by_name ? <span>🧑‍💼 {r.created_by_name}</span> : null}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {!r.is_archived ? (
                    <button
                      onClick={() => setEditRow(r)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-500/20"
                    >
                      ✏️ تعديل
                    </button>
                  ) : null}
                  {!r.is_archived ? (
                    <button
                      onClick={() => archive(r.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20"
                    >
                      <Archive className="h-4 w-4" /> أرشفة
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                      <Archive className="h-3.5 w-3.5" /> في الأرشيف
                    </span>
                  )}
                  <button
                    onClick={() => remove(r.id)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openForm ? (
        <ReceptionForm
          onClose={() => setOpenForm(false)}
          onCreated={(row) => {
            setOpenForm(false);
            setRows((rs) => [row, ...rs]);
            setToast("تم تسجيل المدخلة");
          }}
          userName={userName}
          userId={userId}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-20 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background shadow">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ReceptionForm({
  onClose,
  onCreated,
  userName,
  userId,
}: {
  onClose: () => void;
  onCreated: (row: Row) => void;
  userName: string;
  userId: string | null;
}) {
  const [supplier, setSupplier] = useState("");
  const [goodsType, setGoodsType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<Unit>("طن");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!supplier.trim()) return setError("المورد مطلوب");
    if (!goodsType.trim()) return setError("نوع البضاعة مطلوب");
    if (!quantity || isNaN(qty) || qty <= 0) return setError("الكمية يجب أن تكون رقماً موجباً");
    setSaving(true);
    const payload = {
      supplier: supplier.trim(),
      goods_type: goodsType.trim(),
      quantity: qty,
      unit,
      notes: notes.trim() || null,
      created_by: userId,
      created_by_name: userName,
    };
    const { data, error } = await (supabase as any)
      .from("receptions")
      .insert(payload)
      .select("*")
      .single();
    setSaving(false);
    if (error) return setError("تعذر الحفظ: " + error.message);
    notifyReceptionCreated({
      data: {
        supplier: payload.supplier,
        goods_type: payload.goods_type,
        quantity: qty,
        unit,
        user_name: userName,
      },
    }).catch((e) => console.error("[reception:notify]", e));
    onCreated(data as Row);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">سجل استقبال جديد</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold">المورد *</label>
            <input
              className={inputCls}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="اسم المورد"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">نوع البضاعة *</label>
            <input
              className={inputCls}
              value={goodsType}
              onChange={(e) => setGoodsType(e.target.value)}
              placeholder="مثال: حديد، إسمنت…"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold">الكمية *</label>
              <input
                type="number"
                step="any"
                min="0"
                className={inputCls}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">الوحدة *</label>
              <select
                className={inputCls}
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
              >
                <option value="طن">طن</option>
                <option value="قطعة">قطعة</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">ملاحظات</label>
            <textarea
              className={inputCls}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري"
            />
          </div>
          {error ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold hover:bg-muted"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "جاري الحفظ…" : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
