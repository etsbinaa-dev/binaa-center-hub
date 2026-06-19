import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Phone,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  MessageCircle,
  User,
  FileText,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { OrderAttachmentsView } from "@/components/order-attachments-view";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";

type DeliveryStatus = "new" | "in_progress" | "delivered";

type DeliveryOrder = {
  id: string;
  details: string | null;
  created_at: string;
  delivery_status: DeliveryStatus;
  images: string[] | null;
  files: string[] | null;
  voice_note: string | null;
  driver_name: string | null;
  pointeur_name: string | null;
  delivery_started_at: string | null;
  delivered_at: string | null;
  delivery_invoice_path: string | null;
  delivery_invoice_number: string | null;
  delivery_notes: string | null;
  customers: { id: string; name: string; phone: string } | null;
};

const BUCKET = "order-attachments";

function normalizePhone(p: string) {
  return (p || "").replace(/[^\d+]/g, "");
}

function fmtDateTime(s: string | null, latn = false) {
  if (!s) return "—";
  return new Date(s).toLocaleString(latn ? "ar-EG-u-nu-latn" : "ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function DeliveryList({ view }: { view: "active" | "archive" }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [startTarget, setStartTarget] = useState<DeliveryOrder | null>(null);

  const { data: orders = [], isLoading, isError, error } = useQuery<DeliveryOrder[], Error>({
    queryKey: ["delivery", view, search],
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select(
          "id,details,created_at,delivery_status,images,files,voice_note,driver_name,pointeur_name,delivery_started_at,delivered_at,delivery_invoice_path,delivery_invoice_number,delivery_notes,customers:customer_id(id,name,phone)",
        )
        .eq("status", "archived");
      if (view === "archive") q = q.eq("delivery_status", "delivered");
      else q = q.in("delivery_status", ["new", "in_progress"]);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data as unknown as DeliveryOrder[]) ?? [];
      if (!search.trim()) return list;
      const s = search.toLowerCase();
      return list.filter(
        (o) =>
          o.customers?.name.toLowerCase().includes(s) ||
          o.customers?.phone.includes(s) ||
          (o.delivery_invoice_number ?? "").toLowerCase().includes(s),
      );
    },
  });

  const completeDelivery = useMutation({
    mutationFn: async (id: string) => {
      const order = orders.find((o) => o.id === id);
      const { error } = await supabase
        .from("orders")
        .update({ delivery_status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return order;
    },
    onSuccess: (order, id) => {
      qc.invalidateQueries({ queryKey: ["delivery"] });
      qc.invalidateQueries({ queryKey: ["count"] });
      toast.success("تم التسليم");
      const cname = order?.customers?.name ?? "—";
      logActivity({ module: "delivery", action: "delivered", description: `تأكيد تسليم طلب العميل ${cname}` });
      notify("delivery_done", `تم تسليم طلب العميل ${cname}.`, id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{view === "active" ? "طلبات التوصيل" : "أرشيف التوصيل"}</h2>
          <p className="text-sm text-muted-foreground">{orders.length} طلب</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف أو رقم الفاتورة" className="pr-10" />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل…</p>
      ) : isError ? (
        <Card className="p-8 text-center text-destructive">تعذر التحميل: {error.message}</Card>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {view === "active" ? "لا توجد طلبات للتوصيل" : "الأرشيف فارغ"}
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const phone = normalizePhone(o.customers?.phone ?? "");
            const showDispatch =
              o.delivery_status === "in_progress" || o.delivery_status === "delivered";
            return (
              <Card key={o.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{o.customers?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                      <Phone className="h-3 w-3" />{o.customers?.phone}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <DeliveryBadge status={o.delivery_status} />
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(o.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                </div>
                {o.details && o.details.trim() && (
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-2">{o.details}</p>
                )}
                <OrderAttachmentsView images={o.images} voice={o.voice_note} files={o.files} />

                {showDispatch && (
                  <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-muted-foreground">السائق:</span>
                      <span className="font-medium">{o.driver_name ?? "—"}</span>
                      <span className="text-muted-foreground">البوانتور:</span>
                      <span className="font-medium">{o.pointeur_name ?? "—"}</span>
                      <span className="text-muted-foreground">رقم الفاتورة:</span>
                      <span className="font-medium">{o.delivery_invoice_number ?? "—"}</span>
                      <span className="text-muted-foreground">بدء التوصيل:</span>
                      <span className="font-medium">{fmtDateTime(o.delivery_started_at)}</span>
                      {o.delivery_status === "delivered" && (
                        <>
                          <span className="text-muted-foreground">تم التسليم:</span>
                          <span className="font-medium">{fmtDateTime(o.delivered_at)}</span>
                        </>
                      )}
                    </div>
                    {o.delivery_notes && (
                      <p className="whitespace-pre-wrap pt-1">📝 {o.delivery_notes}</p>
                    )}
                    {o.delivery_invoice_path && (
                      <div className="pt-1">
                        <OrderAttachmentsView images={null} voice={null} files={[o.delivery_invoice_path]} />
                      </div>
                    )}
                  </div>
                )}

                {view === "active" && (
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    {phone && (
                      <>
                        <Button asChild size="sm" variant="outline">
                          <a href={`https://wa.me/${phone.replace(/^\+/, "")}`} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-4 w-4 ml-1" />واتساب
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <a href={`tel:${phone}`}>
                            <Phone className="h-4 w-4 ml-1" />اتصال
                          </a>
                        </Button>
                      </>
                    )}
                    {o.delivery_status === "new" && (
                      <Button size="sm" variant="secondary" onClick={() => setStartTarget(o)}>
                        <Truck className="h-4 w-4 ml-1" />بدء التوصيل
                      </Button>
                    )}
                    {o.delivery_status === "in_progress" && (
                      <Button size="sm" variant="default" onClick={() => completeDelivery.mutate(o.id)}>
                        <PackageCheck className="h-4 w-4 ml-1" />تم التسليم
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <StartDeliveryDialog
        order={startTarget}
        onClose={() => setStartTarget(null)}
        onStarted={() => {
          qc.invalidateQueries({ queryKey: ["delivery"] });
          qc.invalidateQueries({ queryKey: ["count"] });
        }}
      />
    </div>
  );
}

function StartDeliveryDialog({
  order,
  onClose,
  onStarted,
}: {
  order: DeliveryOrder | null;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [driver, setDriver] = useState("");
  const [pointeur, setPointeur] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) {
      setDriver(order.driver_name ?? "");
      setPointeur(order.pointeur_name ?? "");
      setInvoiceNumber(order.delivery_invoice_number ?? "");
      setNotes(order.delivery_notes ?? "");
      setFile(null);
    }
  }, [order]);

  const open = order !== null;

  const submit = async () => {
    if (!order) return;
    if (!driver.trim()) return toast.error("اسم السائق مطلوب");
    if (!pointeur.trim()) return toast.error("اسم البوانتور مطلوب");
    if (!file) return toast.error("نسخة الفاتورة الرقمية مطلوبة");
    const isOk = file.type.startsWith("image/") || file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isOk) return toast.error("الملف يجب أن يكون صورة أو PDF");

    setBusy(true);
    try {
      const customerId = order.customers?.id ?? "unknown";
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${customerId}/${Date.now()}/delivery-invoice-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;

      const startedAt = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          delivery_status: "in_progress",
          delivery_started_at: startedAt,
          driver_name: driver.trim(),
          pointeur_name: pointeur.trim(),
          delivery_invoice_number: invoiceNumber.trim() || null,
          delivery_notes: notes.trim() || null,
          delivery_invoice_path: path,
        })
        .eq("id", order.id);
      if (updErr) throw updErr;

      const cname = order.customers?.name ?? "—";
      toast.success("بدأ التوصيل");
      logActivity({
        module: "delivery",
        action: "start_delivery",
        description: `بدء توصيل طلب العميل ${cname} — السائق ${driver.trim()}`,
      });
      notify("delivery_start", `بدأ توصيل طلب العميل ${cname}.`, order.id);
      onStarted();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر بدء التوصيل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>بدء التوصيل</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dlv-driver" className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />اسم السائق <span className="text-destructive">*</span>
            </Label>
            <Input id="dlv-driver" value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="مثال: محمد" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dlv-pointeur" className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />اسم البوانتور <span className="text-destructive">*</span>
            </Label>
            <Input id="dlv-pointeur" value={pointeur} onChange={(e) => setPointeur(e.target.value)} placeholder="مثال: علي" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dlv-invnum" className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />رقم الفاتورة
            </Label>
            <Input id="dlv-invnum" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="مثال: 26T03001" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />نسخة الفاتورة (صورة أو PDF) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="flex items-center gap-2 text-xs rounded-md border bg-muted/40 p-2">
                <FileText className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">{file.name}</span>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setFile(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dlv-notes">ملاحظات (اختياري)</Label>
            <Textarea id="dlv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>إلغاء</Button>
          <Button onClick={submit} disabled={busy}>
            <Truck className="h-4 w-4 ml-1" />
            {busy ? "جاري البدء…" : "بدء التوصيل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-muted bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" />تم التسليم
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
        <Truck className="h-3 w-3" />جاري التوصيل
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
      <Truck className="h-3 w-3" />جديد
    </span>
  );
}
