import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { extractInvoiceFields } from "@/lib/invoice-extract.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Upload,
  Eye,
  Send,
  
  Phone,
  Receipt,
  ImageOff,
  Trash2,
  Pencil,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

const BUCKET = "invoice-files";

async function convertToPng(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Invoice = {
  id: string;
  customer_name: string;
  customer_phone: string;
  invoice_number: string;
  image_path: string | null;
  status: "new" | "sent";
  sent_at: string | null;
  created_at: string;
};

export function InvoicesList({ status }: { status: "new" | "sent" }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", status, search],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data as Invoice[]) ?? [];
      const s = search.trim().toLowerCase();
      if (!s) return list;
      return list.filter(
        (i) =>
          i.customer_name.toLowerCase().includes(s) ||
          i.customer_phone.includes(s) ||
          i.invoice_number.toLowerCase().includes(s),
      );
    },
  });

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("تم نقل الفاتورة إلى تبويب «تم الإرسال»");
      logActivity({ module: "invoices", action: "mark_sent", description: "وضع فاتورة كمُرسلة" });
    },
    onError: (e: Error) => toast.error("تعذر تحديث الحالة: " + e.message),
  });

  const markNew = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "new", sent_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("تم إرجاع الفاتورة إلى الفواتير الجديدة");
    },
  });

  const remove = useMutation({
    mutationFn: async (inv: Invoice) => {
      if (inv.image_path) {
        await supabase.storage.from(BUCKET).remove([inv.image_path]);
      }
      const { error } = await supabase.from("invoices").delete().eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("تم حذف الفاتورة");
      logActivity({ module: "invoices", action: "delete", description: "حذف فاتورة" });
    },
    onError: (e: Error) => toast.error("تعذر الحذف: " + e.message),
  });

  return (
    <div className="space-y-4">
      {/* Search + Import */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف أو رقم الفاتورة"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          استيراد فواتير
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          جارٍ التحميل…
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            {status === "new" ? "لا توجد فواتير جديدة" : "لا توجد فواتير مُرسلة بعد"}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              onView={() => setViewing(inv)}
              onEdit={() => setEditing(inv)}
              onMarkSent={() => markSent.mutate(inv.id)}
              onMarkNew={() => markNew.mutate(inv.id)}
              onDelete={() => remove.mutate(inv)}
              canDelete={isAdmin}
            />
          ))}
        </div>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ViewDialog invoice={viewing} onOpenChange={(o) => !o && setViewing(null)} />
      <EditDialog
        invoice={editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

function InvoiceCard({
  invoice,
  onView,
  onEdit,
  onMarkSent,
  onMarkNew,
  onDelete,
  canDelete,
}: {
  invoice: Invoice;
  onView: () => void;
  onEdit: () => void;
  onMarkSent: () => void;
  onMarkNew: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const thumb = useSignedUrl(invoice.image_path);

  const phoneDigits = invoice.customer_phone.replace(/[^\d]/g, "");
  const waLink = `https://wa.me/${phoneDigits}`;

  async function copyImage(): Promise<boolean> {
    if (!invoice.image_path) return false;
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(invoice.image_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("no url");
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const ClipItem = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (!ClipItem || !navigator.clipboard?.write) return false;
      // Some browsers only allow image/png in clipboard
      let finalBlob = blob;
      if (blob.type !== "image/png") {
        try {
          finalBlob = await convertToPng(blob);
        } catch {
          finalBlob = blob;
        }
      }
      await navigator.clipboard.write([new ClipItem({ [finalBlob.type]: finalBlob })]);
      return true;
    } catch (e) {
      console.warn("[invoice] copy image failed", e);
      return false;
    }
  }

  async function handleWhatsApp() {
    if (!phoneDigits) {
      toast.error("لا يوجد رقم واتساب لهذا العميل");
      return;
    }
    if (invoice.image_path) {
      const ok = await copyImage();
      if (ok) toast.success("تم نسخ صورة الفاتورة — الصقها داخل واتساب");
      else toast.message("افتح المحادثة ثم اضغط «نسخ الصورة» للصقها يدوياً");
    }
    window.open(waLink, "_blank", "noopener,noreferrer");
    if (invoice.status === "new") onMarkSent();
  }

  async function handleCopyImage() {
    const ok = await copyImage();
    if (ok) toast.success("تم نسخ صورة الفاتورة إلى الحافظة");
    else toast.error("المتصفح لا يدعم نسخ الصور إلى الحافظة");
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt={`فاتورة ${invoice.invoice_number}`}
            className="h-full w-full cursor-pointer object-cover"
            onClick={onView}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span
          className={`absolute end-2 top-2 rounded-md px-2 py-0.5 text-xs font-bold ${
            invoice.status === "sent"
              ? "bg-green-500/15 text-green-700 dark:text-green-400"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
          }`}
        >
          {invoice.status === "sent" ? "تم الإرسال" : "غير مرسلة"}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-bold leading-tight">
          {invoice.customer_name === "غير معروف" && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          {invoice.customer_name}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span dir="ltr">{invoice.customer_phone || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" />
          رقم الفاتورة: <span className="font-mono">{invoice.invoice_number}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onView}>
          <Eye className="h-4 w-4" />
          عرض
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          تعديل
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleWhatsApp}>
          <Send className="h-4 w-4" />
          واتساب
        </Button>
        {invoice.image_path && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopyImage}>
            <Copy className="h-4 w-4" />
            نسخ الصورة
          </Button>
        )}
        {invoice.status === "sent" && (
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={onMarkNew}>
            إرجاع
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto text-destructive"
            onClick={onDelete}
            aria-label="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function useSignedUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

function ViewDialog({
  invoice,
  onOpenChange,
}: {
  invoice: Invoice | null;
  onOpenChange: (o: boolean) => void;
}) {
  const url = useSignedUrl(invoice?.image_path ?? null);
  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            فاتورة {invoice?.invoice_number} — {invoice?.customer_name}
          </DialogTitle>
        </DialogHeader>
        {url ? (
          <img src={url} alt="فاتورة" className="max-h-[70vh] w-full rounded-lg object-contain" />
        ) : (
          <div className="grid h-64 place-items-center text-sm text-muted-foreground">
            لا توجد صورة
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const extract = useServerFn(extractInvoiceFields);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunk)),
      );
    }
    return btoa(binary);
  }

  async function extractFromFile(f: File) {
    const b64 = await fileToBase64(f);
    return extract({ data: { imageBase64: b64, mimeType: f.type || "image/jpeg" } });
  }

  function reset() {
    setBulkFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadFile(f: File): Promise<string> {
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user?.id ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async function handleBulk() {
    if (bulkFiles.length === 0) return;
    setBusy(true);
    let ok = 0;
    let missing = 0;
    let failed = 0;
    try {
      for (const f of bulkFiles) {
        const fallbackInv = f.name.replace(/\.[^.]+$/, "");
        let customer_name = "غير معروف";
        let customer_phone = "";
        let invoice_number = fallbackInv;

        try {
          const extracted = await extractFromFile(f);
          console.debug("[invoice-extract] OCR raw text for", f.name, "\n", extracted.raw_text);
          console.debug("[invoice-extract] parsed", f.name, {
            customer_name: extracted.customer_name,
            customer_phone: extracted.customer_phone,
            invoice_number: extracted.invoice_number,
            error: extracted.error,
          });

          if (extracted.customer_name) customer_name = extracted.customer_name;
          if (extracted.customer_phone) customer_phone = extracted.customer_phone;
          if (extracted.invoice_number) invoice_number = extracted.invoice_number;

          if (!extracted.customer_name && !extracted.customer_phone) {
            missing++;
            toast.warning(`${f.name}: تعذر استخراج بيانات العميل من الفاتورة`);
          }
        } catch (e) {
          console.error("[invoice-extract] OCR failed for", f.name, e);
          toast.warning(`${f.name}: تعذر استخراج بيانات العميل من الفاتورة`);
        }

        try {
          const path = await uploadFile(f);
          const { error } = await supabase.from("invoices").insert({
            customer_name,
            customer_phone,
            invoice_number,
            image_path: path,
            status: "new",
            created_by: user?.id ?? null,
          });
          if (error) throw error;
          ok++;
        } catch (e) {
          failed++;
          console.error("[invoice-extract] save failed", f.name, e);
          toast.error(`${f.name}: تعذر حفظ الفاتورة`);
        }
      }

      if (ok > 0) {
        toast.success(`تم استيراد ${ok} فاتورة`);
        logActivity({
          module: "invoices",
          action: "import",
          description: `استيراد ${ok} فاتورة جديدة`,
        });
      }
      if (missing > 0) console.warn(`[invoice-extract] ${missing} invoice(s) without customer data`);
      if (failed > 0 && ok === 0) toast.error(`فشل استيراد ${failed} فاتورة`);

      qc.invalidateQueries({ queryKey: ["invoices"] });
      if (ok > 0) {
        reset();
        onOpenChange(false);
      }
    } catch (e) {
      console.error("[invoice-extract] bulk failed", e);
      toast.error("تعذر إكمال الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>استيراد فواتير</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setBulkFiles(Array.from(e.target.files ?? []))}
          />
          <Button
            onClick={handleBulk}
            disabled={busy || bulkFiles.length === 0}
            className="w-full"
          >
            {busy ? "جارٍ الاستيراد…" : `استيراد ${bulkFiles.length || ""} فاتورة`}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  invoice,
  onOpenChange,
}: {
  invoice: Invoice | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (invoice) {
      setName(invoice.customer_name);
      setPhone(invoice.customer_phone);
      setNumber(invoice.invoice_number);
    }
  }, [invoice]);

  async function save() {
    if (!invoice) return;
    if (!name.trim() || !number.trim()) {
      toast.error("الاسم ورقم الفاتورة مطلوبان");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          invoice_number: number.trim(),
        })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success("تم تحديث بيانات الفاتورة");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
    } catch (e) {
      toast.error("تعذر التحديث: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل الفاتورة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>اسم العميل</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>رقم الواتساب</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
            />
          </div>
          <div className="space-y-1">
            <Label>رقم الفاتورة</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
