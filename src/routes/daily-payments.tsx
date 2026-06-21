import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Plus,
  X,
  Trash2,
  RefreshCw,
  Check,
  Archive,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  ArrowLeftRight,
  Home,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/daily-payments")({
  head: () => ({ meta: [{ title: "الصندوق والمتابعة المؤقتة — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="daily_payments" title="الصندوق والمتابعة المؤقتة">
      <RequireAuth>
        <CashAndFollowupPage />
      </RequireAuth>
    </AppShell>
  ),
});

type TabKind = "temp" | "house" | "archive";

type EntryKind = "income" | "expense";
type TempRow = {
  id: string;
  kind: EntryKind;
  amount: number;
  description: string | null;
  notes: string | null;
  status: string;
  created_by_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
};

type OpType =
  | "central_to_house"
  | "house_to_bank"
  | "house_to_central"
  | "add_cash"
  | "withdraw_cash";

type HouseRow = {
  id: string;
  op_type: OpType;
  amount: number;
  notes: string | null;
  status: string;
  created_by_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
};

const OP_META: Record<
  OpType,
  { label: string; sign: 1 | -1 | 0; icon: typeof ArrowUpCircle; color: string }
> = {
  central_to_house: { label: "📤 من الكيص المركزي → كيص الدار", sign: +1, icon: ArrowLeftRight, color: "text-emerald-600" },
  house_to_bank: { label: "🏦 من كيص الدار → البنك", sign: -1, icon: Landmark, color: "text-rose-600" },
  house_to_central: { label: "📥 من كيص الدار → الكيص المركزي", sign: -1, icon: ArrowLeftRight, color: "text-rose-600" },
  add_cash: { label: "➕ إضافة نقدية إلى كيص الدار", sign: +1, icon: ArrowUpCircle, color: "text-emerald-600" },
  withdraw_cash: { label: "➖ سحب نقدية من كيص الدار", sign: -1, icon: ArrowDownCircle, color: "text-rose-600" },
};

const OP_OPTIONS: { value: OpType; label: string }[] = (Object.keys(OP_META) as OpType[]).map(
  (k) => ({ value: k, label: OP_META[k].label }),
);

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

function CashAndFollowupPage() {
  const { user } = useAuth();
  const userName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || "مستخدم";
  const userId = user?.id ?? null;

  const [tab, setTab] = useState<TabKind>("temp");
  const [temp, setTemp] = useState<TempRow[]>([]);
  const [house, setHouse] = useState<HouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [openTempForm, setOpenTempForm] = useState(false);
  const [openHouseForm, setOpenHouseForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: t, error: te }, { data: h, error: he }] = await Promise.all([
        (supabase as any)
          .from("temp_entries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("house_cash_ops")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (te) console.error("[temp_entries:load]", te);
      if (he) console.error("[house_cash_ops:load]", he);
      setTemp((t ?? []) as TempRow[]);
      setHouse((h ?? []) as HouseRow[]);
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

  // House cash balance (all ops, regardless of review status)
  const houseBalance = useMemo(
    () =>
      house.reduce(
        (acc, r) => acc + OP_META[r.op_type].sign * (Number(r.amount) || 0),
        0,
      ),
    [house],
  );

  const tempActive = useMemo(() => temp.filter((r) => r.status !== "done"), [temp]);
  const houseActive = useMemo(() => house.filter((r) => r.status !== "done"), [house]);

  type Mixed =
    | { kind: "temp"; row: TempRow }
    | { kind: "house"; row: HouseRow };
  const archived = useMemo<Mixed[]>(() => {
    const items: Mixed[] = [
      ...temp.filter((r) => r.status === "done").map((row) => ({ kind: "temp" as const, row })),
      ...house.filter((r) => r.status === "done").map((row) => ({ kind: "house" as const, row })),
    ];
    items.sort((a, b) => (b.row.reviewed_at || b.row.created_at).localeCompare(a.row.reviewed_at || a.row.created_at));
    return items;
  }, [temp, house]);

  const markDone = async (table: "temp_entries" | "house_cash_ops", id: string) => {
    const patch = {
      status: "done",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      reviewed_by_name: userName,
    };
    const { error } = await (supabase as any).from(table).update(patch).eq("id", id);
    if (error) return setToast("تعذر التحديث: " + error.message);
    if (table === "temp_entries") {
      setTemp((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } else {
      setHouse((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }
    setToast("تم نقلها إلى الأرشيف");
  };

  const remove = async (table: "temp_entries" | "house_cash_ops", id: string) => {
    if (!confirm("حذف هذه العملية؟")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return setToast("تعذر الحذف: " + error.message);
    if (table === "temp_entries") setTemp((rs) => rs.filter((r) => r.id !== id));
    else setHouse((rs) => rs.filter((r) => r.id !== id));
    setToast("تم الحذف");
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">💰 الصندوق والمتابعة المؤقتة</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              دفتر متابعة سريع للمدير والمحاسب: قيود مؤقتة + حركات كيص الدار.
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { k: "temp", label: "📝 القيود المؤقتة" },
          { k: "house", label: "🏠 كيص الدار" },
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

      {tab === "temp" ? (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setOpenTempForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> قيد جديد
            </button>
          </div>
          {loading ? (
            <Loading />
          ) : tempActive.length === 0 ? (
            <Empty text="لا توجد قيود غير معالجة." />
          ) : (
            <ul className="space-y-2">
              {tempActive.map((r) => (
                <TempCard
                  key={r.id}
                  r={r}
                  onDone={() => markDone("temp_entries", r.id)}
                  onRemove={() => remove("temp_entries", r.id)}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}

      {tab === "house" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">رصيد كيص الدار الحالي</span>
            </div>
            <div
              className={`text-xl font-extrabold ${
                houseBalance < 0 ? "text-rose-600" : "text-primary"
              }`}
            >
              {formatAmount(houseBalance)}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setOpenHouseForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> عملية جديدة
            </button>
          </div>
          {loading ? (
            <Loading />
          ) : houseActive.length === 0 ? (
            <Empty text="لا توجد عمليات غير معالجة." />
          ) : (
            <ul className="space-y-2">
              {houseActive.map((r) => (
                <HouseCard
                  key={r.id}
                  r={r}
                  onDone={() => markDone("house_cash_ops", r.id)}
                  onRemove={() => remove("house_cash_ops", r.id)}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}

      {tab === "archive" ? (
        loading ? (
          <Loading />
        ) : archived.length === 0 ? (
          <Empty text="الأرشيف فارغ." />
        ) : (
          <ul className="space-y-2">
            {archived.map((m) =>
              m.kind === "temp" ? (
                <TempCard
                  key={"t-" + m.row.id}
                  r={m.row}
                  onDone={() => {}}
                  onRemove={() => remove("temp_entries", m.row.id)}
                  archived
                />
              ) : (
                <HouseCard
                  key={"h-" + m.row.id}
                  r={m.row}
                  onDone={() => {}}
                  onRemove={() => remove("house_cash_ops", m.row.id)}
                  archived
                />
              ),
            )}
          </ul>
        )
      ) : null}

      {openTempForm ? (
        <TempForm
          onClose={() => setOpenTempForm(false)}
          onCreated={(row) => {
            setOpenTempForm(false);
            setTemp((rs) => [row, ...rs]);
            setToast("تم تسجيل القيد");
          }}
          userName={userName}
          userId={userId}
        />
      ) : null}
      {openHouseForm ? (
        <HouseForm
          onClose={() => setOpenHouseForm(false)}
          onCreated={(row) => {
            setOpenHouseForm(false);
            setHouse((rs) => [row, ...rs]);
            setToast("تم تسجيل العملية");
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

function Loading() {
  return <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function StatusBadge({ done }: { done: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
        done ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
      }`}
    >
      {done ? "✅ تم" : "🟡 غير معالج"}
    </span>
  );
}

function RowActions({
  done,
  archived,
  onDone,
  onRemove,
}: {
  done: boolean;
  archived?: boolean;
  onDone: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {!done && !archived ? (
        <button
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20"
        >
          <Check className="h-4 w-4" /> تم
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          <Archive className="h-3.5 w-3.5" /> مؤرشفة
        </span>
      )}
      <button
        onClick={onRemove}
        className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
        aria-label="حذف"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function TempCard({
  r,
  onDone,
  onRemove,
  archived,
}: {
  r: TempRow;
  onDone: () => void;
  onRemove: () => void;
  archived?: boolean;
}) {
  const done = r.status === "done";
  const isIncome = r.kind === "income";
  return (
    <li className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
              }`}
            >
              {isIncome ? "➕ دخل" : "➖ خرج"}
            </span>
            <StatusBadge done={done} />
          </div>
          <div
            className={`mt-1 text-lg font-extrabold ${
              isIncome ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {isIncome ? "+" : "−"} {formatAmount(Number(r.amount) || 0)}
          </div>
          {r.description ? (
            <p className="mt-1 text-sm font-medium">{r.description}</p>
          ) : null}
          {r.notes ? (
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.notes}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>🕒 {formatDateTime(r.created_at)}</span>
            {r.created_by_name ? <span>🧑‍💼 {r.created_by_name}</span> : null}
            {done && r.reviewed_at ? (
              <span>
                ✅ {formatDateTime(r.reviewed_at)}
                {r.reviewed_by_name ? ` — ${r.reviewed_by_name}` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <RowActions done={done} archived={archived} onDone={onDone} onRemove={onRemove} />
      </div>
    </li>
  );
}

function HouseCard({
  r,
  onDone,
  onRemove,
  archived,
}: {
  r: HouseRow;
  onDone: () => void;
  onRemove: () => void;
  archived?: boolean;
}) {
  const done = r.status === "done";
  const meta = OP_META[r.op_type];
  const Icon = meta.icon;
  const sign = meta.sign;
  return (
    <li className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-bold ${meta.color}`}>
              <Icon className="h-4 w-4" /> {meta.label}
            </span>
            <StatusBadge done={done} />
          </div>
          <div
            className={`mt-1 text-lg font-extrabold ${
              sign > 0 ? "text-emerald-600" : sign < 0 ? "text-rose-600" : "text-primary"
            }`}
          >
            {sign > 0 ? "+" : sign < 0 ? "−" : ""} {formatAmount(Number(r.amount) || 0)}
          </div>
          {r.notes ? (
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.notes}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>🕒 {formatDateTime(r.created_at)}</span>
            {r.created_by_name ? <span>🧑‍💼 {r.created_by_name}</span> : null}
            {done && r.reviewed_at ? (
              <span>
                ✅ {formatDateTime(r.reviewed_at)}
                {r.reviewed_by_name ? ` — ${r.reviewed_by_name}` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <RowActions done={done} archived={archived} onDone={onDone} onRemove={onRemove} />
      </div>
    </li>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TempForm({
  onClose,
  onCreated,
  userName,
  userId,
}: {
  onClose: () => void;
  onCreated: (row: TempRow) => void;
  userName: string;
  userId: string | null;
}) {
  const [kind, setKind] = useState<EntryKind>("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount.replace(/[,\s]/g, ""));
    if (!isFinite(amt) || amt <= 0) return setError("أدخل مبلغًا صحيحًا");
    setSaving(true);
    try {
      const payload = {
        kind,
        amount: amt,
        description: description.trim() || null,
        notes: notes.trim() || null,
        created_by: userId,
        created_by_name: userName,
      };
      const { data, error } = await (supabase as any)
        .from("temp_entries")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      onCreated(data as TempRow);
    } catch (e: any) {
      setError(e?.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="قيد مؤقت جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["income", "expense"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                kind === k
                  ? k === "income"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : "border-rose-500 bg-rose-500/10 text-rose-600"
                  : "border-border bg-background"
              }`}
            >
              {k === "income" ? "➕ دخل" : "➖ خرج"}
            </button>
          ))}
        </div>
        <FormField label="المبلغ *">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
            placeholder="0"
            autoFocus
          />
        </FormField>
        <FormField label="الوصف">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </FormField>
        <FormField label="ملاحظات">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </FormField>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "…جاري الحفظ" : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HouseForm({
  onClose,
  onCreated,
  userName,
  userId,
}: {
  onClose: () => void;
  onCreated: (row: HouseRow) => void;
  userName: string;
  userId: string | null;
}) {
  const [opType, setOpType] = useState<OpType>("central_to_house");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount.replace(/[,\s]/g, ""));
    if (!isFinite(amt) || amt <= 0) return setError("أدخل مبلغًا صحيحًا");
    setSaving(true);
    try {
      const payload = {
        op_type: opType,
        amount: amt,
        notes: notes.trim() || null,
        created_by: userId,
        created_by_name: userName,
      };
      const { data, error } = await (supabase as any)
        .from("house_cash_ops")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      onCreated(data as HouseRow);
    } catch (e: any) {
      setError(e?.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="عملية كيص الدار" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="نوع العملية *">
          <select
            value={opType}
            onChange={(e) => setOpType(e.target.value as OpType)}
            className={inputCls}
          >
            {OP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="المبلغ *">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
            placeholder="0"
            autoFocus
          />
        </FormField>
        <FormField label="ملاحظات">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputCls}
          />
        </FormField>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "…جاري الحفظ" : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
