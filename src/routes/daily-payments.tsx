import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Wallet, Plus, Image as ImageIcon, X, Trash2, RefreshCw, Check, Archive } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notifyDailyPayment, type DailyPaymentMethod } from "@/lib/daily-payments.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/daily-payments")({
  head: () => ({ meta: [{ title: "التحصيل اليومي — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="daily_payments" title="التحصيل اليومي">
      <RequireAuth>
        <DailyPaymentsPage />
      </RequireAuth>
    </AppShell>
  ),
});

type ViewKind = "active" | "archive";

type Row = {
  id: string;
  customer_name: string;
  invoice_number: string | null;
  amount: number;
  payment_method: DailyPaymentMethod;
  image_path: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  status?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
};

const METHODS: { value: DailyPaymentMethod; label: string }[] = [
  { value: "bankily", label: "Bankily" },
  { value: "seddad", label: "Seddad" },
  { value: "cash", label: "نقدًا" },
  { value: "check", label: "شيك" },
  { value: "other", label: "أخرى" },
];

const METHOD_LABEL: Record<DailyPaymentMethod, string> = Object.fromEntries(
  METHODS.map((m) => [m.value, m.label]),
) as Record<DailyPaymentMethod, string>;


function formatAmount(n: number) {
  try { return new Intl.NumberFormat("fr-FR").format(n); } catch { return String(n); }
}
function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "short", timeStyle: "short",
    }).format(new Date(iso));
  } catch { return iso; }
}

function DailyPaymentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKind>("active");
  const [openForm, setOpenForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = useServerFn(notifyDailyPayment);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("daily_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("[daily-payments:load]", error);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    return rows.filter((r) =>
      view === "archive" ? r.status === "done" : r.status !== "done",
    );
  }, [rows, view]);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    "مستخدم";

  const markDone = async (id: string) => {
    const patch = {
      status: "done",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      reviewed_by_name: userName,
    };
    const { error } = await (supabase as any)
      .from("daily_payments")
      .update(patch)
      .eq("id", id);
    if (error) setToast("تعذر التحديث: " + error.message);
    else {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setToast("تم نقلها إلى الأرشيف");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه العملية؟")) return;
    const { error } = await (supabase as any).from("daily_payments").delete().eq("id", id);
    if (error) setToast("تعذر الحذف: " + error.message);
    else {
      setRows((rs) => rs.filter((r) => r.id !== id));
      setToast("تم الحذف");
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">التحصيل اليومي</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              دفتر مشترك لتسجيل عمليات تحصيل المدفوعات اليومية بين المدير والمحاسب.
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> إضافة
        </button>
      </div>

      {/* View toggle */}
      <div className="flex flex-wrap gap-2">
        {([
          { k: "active", label: "غير معالجة" },
          { k: "archive", label: "الأرشيف" },
        ] as const).map((f) => (
          <button
            key={f.k}
            onClick={() => setView(f.k)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              view === f.k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={load}
          className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          aria-label="تحديث"
        >
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          لا توجد عمليات تحصيل ضمن هذا النطاق.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{r.customer_name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {METHOD_LABEL[r.payment_method] ?? r.payment_method}
                    </span>
                    {r.invoice_number ? (
                      <span className="text-xs text-muted-foreground">
                        فاتورة #{r.invoice_number}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-primary">
                    {formatAmount(Number(r.amount) || 0)}
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
                  {r.image_path ? (
                    <AttachmentPreview path={r.image_path} />
                  ) : null}
                </div>
                <button
                  onClick={() => remove(r.id)}
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openForm ? (
        <PaymentForm
          onClose={() => setOpenForm(false)}
          onCreated={async (saved) => {
            setOpenForm(false);
            setRows((rs) => [saved, ...rs]);
            setToast("تم تسجيل العملية");
            try {
              await notify({
                data: {
                  customerName: saved.customer_name,
                  amount: Number(saved.amount) || 0,
                  method: saved.payment_method,
                  userName,
                },
              });
            } catch (e) {
              console.error("[daily-payments:notify]", e);
            }
          }}
          userName={userName}
          userId={user?.id ?? null}
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

function AttachmentPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage
        .from("daily-payments")
        .createSignedUrl(path, 60 * 60);
      if (!cancel) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancel = true; };
  }, [path]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
      <img src={url} alt="" className="max-h-32 rounded-lg border border-border object-cover" />
    </a>
  );
}

function PaymentForm({
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
  const [customer, setCustomer] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DailyPaymentMethod>("bankily");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount.replace(/[,\s]/g, ""));
    if (!customer.trim()) return setError("أدخل اسم العميل");
    if (!isFinite(amt) || amt <= 0) return setError("أدخل مبلغًا صحيحًا");
    setSaving(true);
    try {
      let imagePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("daily-payments")
          .upload(key, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        imagePath = key;
      }
      const payload = {
        customer_name: customer.trim(),
        invoice_number: invoiceNumber.trim() || null,
        amount: amt,
        payment_method: method,
        image_path: imagePath,
        notes: notes.trim() || null,
        created_by: userId,
        created_by_name: userName,
      };
      const { data, error } = await (supabase as any)
        .from("daily_payments")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      onCreated(data as Row);
    } catch (e: any) {
      console.error("[daily-payments:save]", e);
      setError(e?.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">عملية تحصيل جديدة</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="اسم العميل *">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </FormField>
          <FormField label="رقم الفاتورة (اختياري)">
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField label="المبلغ *">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </FormField>
          <FormField label="وسيلة الدفع">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as DailyPaymentMethod)}
              className={inputCls}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="ملاحظات">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </FormField>
          <FormField label="صورة التحويل (اختياري)">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                <ImageIcon className="h-4 w-4" />
                {file ? "تغيير الصورة" : "اختيار صورة"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <span className="truncate text-xs text-muted-foreground" title={file.name}>
                  {file.name}
                </span>
              ) : null}
              {file ? (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="إزالة"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </FormField>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "جاري الحفظ…" : "حفظ"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
