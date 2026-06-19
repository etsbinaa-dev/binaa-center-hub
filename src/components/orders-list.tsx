import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Plus, CheckCircle2, Trash2, Phone, Clock, ChevronDown, Pencil, Archive, RotateCcw, Contact } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramOrderNotification } from "@/lib/telegram.functions";
import { OrderAttachmentInput, type LocalAttachments } from "@/components/order-attachment-input";
import { OrderAttachmentsView } from "@/components/order-attachments-view";
import { logActivity } from "@/lib/activity";

function fireTelegram(
  notify: ReturnType<typeof useServerFn<typeof sendTelegramOrderNotification>>,
  kind: "created" | "invoiced" | "updated",
  o: { customers: { name: string; phone: string } | null; details: string | null },
) {
  notify({
    data: {
      kind,
      customerName: o.customers?.name ?? "—",
      phone: o.customers?.phone ?? "—",
      details: o.details ?? "",
    },
  }).catch((e) => console.error("[telegram] notify failed", e));
}

type Order = {
  id: string; details: string | null; status: "active" | "archived"; created_at: string; invoiced_at: string | null;
  customer_id: string;
  images: string[] | null;
  files: string[] | null;
  voice_note: string | null;
  customers: { id: string; name: string; phone: string } | null;
};

const BUCKET = "order-attachments";

async function uploadAttachments(customerId: string, atts: LocalAttachments) {
  const folder = `${customerId}/${Date.now()}`;
  const imagePaths: string[] = [];
  for (let i = 0; i < atts.images.length; i++) {
    const f = atts.images[i];
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${folder}/img-${i}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    imagePaths.push(path);
  }
  const filePaths: string[] = [];
  for (let i = 0; i < atts.files.length; i++) {
    const f = atts.files[i];
    const safeName = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `${folder}/file-${i}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    filePaths.push(path);
  }
  let voicePath: string | null = null;
  if (atts.voice) {
    voicePath = `${folder}/voice.webm`;
    const { error } = await supabase.storage.from(BUCKET).upload(voicePath, atts.voice, {
      contentType: atts.voice.type || "audio/webm",
      upsert: false,
    });
    if (error) throw error;
  }
  return { imagePaths, voicePath, filePaths };
}

export function OrdersList({ status }: { status: "active" | "archived" }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const notifyTelegram = useServerFn(sendTelegramOrderNotification);

  const { data: orders = [], isLoading, isError, error } = useQuery<Order[], Error>({
    queryKey: ["orders", status, search],
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers:customer_id(id,name,phone)")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data as Order[]) ?? [];
      if (!search.trim()) return list;
      const s = search.toLowerCase();
      return list.filter(o => o.customers?.name.toLowerCase().includes(s) || o.customers?.phone.includes(s));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: "active" | "archived" }) => {
      const order = orders.find((o) => o.id === id);
      const patch = nextStatus === "archived"
        ? { status: nextStatus, invoiced_at: new Date().toISOString() }
        : { status: nextStatus, invoiced_at: null };
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
      return { order, nextStatus };
    },
    onSuccess: ({ order, nextStatus }) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["count", "orders"] });
      toast.success(nextStatus === "archived" ? "تم نقل الطلب إلى الأرشيف" : "تم إرجاع الطلب للنشطة");
      if (order) fireTelegram(notifyTelegram, nextStatus === "archived" ? "invoiced" : "updated", order);
      const cname = order?.customers?.name ?? "—";
      logActivity({
        module: "orders",
        action: nextStatus === "archived" ? "archive" : "restore",
        description: nextStatus === "archived"
          ? `أرشفة طلب العميل ${cname} (تمت الفوترة)`
          : `استعادة طلب العميل ${cname} من الأرشيف`,
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const order = orders.find((o) => o.id === id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
      return order;
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["count", "orders"] });
      toast.success("تم الحذف");
      logActivity({
        module: "orders",
        action: "delete",
        description: `حذف طلب العميل ${order?.customers?.name ?? "—"}`,
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{status === "active" ? "الطلبات النشطة" : "الأرشيف"}</h2>
          <p className="text-sm text-muted-foreground">{orders.length} طلب</p>
        </div>
        {status === "active" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 ml-1" />طلب جديد</Button>
            </DialogTrigger>
            <OrderDialog onDone={() => setOpen(false)} />
          </Dialog>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(nextOpen) => { if (!nextOpen) setEditing(null); }}>
        {editing && <OrderDialog initial={editing} onDone={() => setEditing(null)} />}
      </Dialog>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف" className="pr-10" />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل…</p>
      ) : isError ? (
        <Card className="p-8 text-center text-destructive">تعذر تحميل الطلبات: {error.message}</Card>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا توجد طلبات</Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{o.customers?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                    <Phone className="h-3 w-3" />{o.customers?.phone}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={o.status} />
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {status === "archived" && o.invoiced_at ? (
                      <span>
                        {new Date(o.invoiced_at).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" })}
                        {" "}
                        {new Date(o.invoiced_at).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    ) : (
                      new Date(o.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })
                    )}
                  </div>
                </div>
              </div>
              {o.details && o.details.trim() && (
                <div className="text-sm bg-muted/50 rounded-md p-2 flex flex-col">
                  {o.details.split("\n").map((line, i) => {
                    const hasArabic = /[\u0600-\u06FF]/.test(line);
                    const isLatin = !hasArabic && /[A-Za-z]/.test(line);
                    return (
                      <span
                        key={i}
                        className="block whitespace-pre-wrap"
                        style={
                          isLatin
                            ? { direction: "ltr", textAlign: "left", unicodeBidi: "isolate" }
                            : { direction: "rtl", textAlign: "right", unicodeBidi: "isolate" }
                        }
                      >
                        {line || "\u00A0"}
                      </span>
                    );
                  })}
                </div>
              )}
              <OrderAttachmentsView images={o.images} voice={o.voice_note} files={o.files} />
              <div className="flex justify-end gap-2 pt-1">
                {status === "active" && (
                  <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: o.id, nextStatus: "archived" })}>
                    <CheckCircle2 className="h-4 w-4 ml-1" />تم الفوترة
                  </Button>
                )}
                {status === "archived" && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: o.id, nextStatus: "active" })}>
                    <RotateCcw className="h-4 w-4 ml-1" />إرجاع
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(o)}>
                  <Pencil className="h-4 w-4 ml-1" />تعديل
                </Button>
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
                        <AlertDialogDescription>لا يمكن التراجع.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(o.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "archived" }) {
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-muted bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
        <Archive className="h-3 w-3" />مؤرشف
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
      <CheckCircle2 className="h-3 w-3" />نشط
    </span>
  );
}

function OrderDialog({ onDone, initial }: { onDone: () => void; initial?: Order }) {
  const qc = useQueryClient();
  const notifyTelegram = useServerFn(sendTelegramOrderNotification);
  const isEditing = !!initial;
  const [customerId, setCustomerId] = useState<string | null>(initial?.customer_id ?? null);
  const [customerLabel, setCustomerLabel] = useState(initial?.customers ? `${initial.customers.name} — ${initial.customers.phone}` : "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachments>({ images: [], voice: null, files: [] });
  const [contactsUnavailable, setContactsUnavailable] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name,phone").order("name");
      if (error) throw error;
      return data as { id: string; name: string; phone: string }[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
  }, [customers, search]);

  const createCustomer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("customers").insert({ name: newName, phone: newPhone }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["customers-all"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["count", "customers"] });
      setCustomerId(c.id);
      setCustomerLabel(`${c.name} — ${c.phone}`);
      setNewName(""); setNewPhone("");
      toast.success("تمت إضافة العميل");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      let cid = customerId;
      let cName = customers.find((x) => x.id === cid)?.name ?? "";
      let cPhone = customers.find((x) => x.id === cid)?.phone ?? "";

      // Auto-create / reuse customer from inline name+phone if no selection
      if (!cid && newName.trim() && newPhone.trim()) {
        const phone = newPhone.trim();
        const existing = customers.find((x) => x.phone === phone);
        if (existing) {
          cid = existing.id;
          cName = existing.name;
          cPhone = existing.phone;
        } else {
          const { data, error } = await supabase
            .from("customers")
            .insert({ name: newName.trim(), phone })
            .select()
            .single();
          if (error) throw error;
          cid = data.id;
          cName = data.name;
          cPhone = data.phone;
          qc.invalidateQueries({ queryKey: ["customers-all"] });
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["count", "customers"] });
        }
      }

      if (!cid) throw new Error("اختر عميلاً أو أدخل الاسم والهاتف");
      const hasExistingAttachments = !!initial && Boolean(initial.images?.length || initial.voice_note || initial.files?.length);
      if (!details.trim() && attachments.images.length === 0 && !attachments.voice && attachments.files.length === 0 && !hasExistingAttachments) {
        throw new Error("أضف تفاصيل أو صورة أو تسجيلاً صوتياً أو ملفاً");
      }
      const { imagePaths, voicePath, filePaths } = await uploadAttachments(cid, attachments);

      if (initial) {
        const { error } = await supabase.from("orders").update({
          customer_id: cid,
          details: details.trim() ? details : null,
          images: [...(initial.images ?? []), ...imagePaths],
          voice_note: voicePath ?? initial.voice_note,
          files: [...(initial.files ?? []), ...filePaths],
        }).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("orders").insert({
          customer_id: cid,
          details: details.trim() ? details : null,
          images: imagePaths,
          voice_note: voicePath,
          files: filePaths,
        });
        if (error) throw error;
      }
      return { name: cName || "—", phone: cPhone || "—", details };
    },
    onSuccess: (info) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["count", "orders"] });
      fireTelegram(notifyTelegram, initial ? "updated" : "created", {
        customers: { name: info.name, phone: info.phone },
        details: info.details,
      });
      toast.success(initial ? "تم تحديث الطلب" : "تم إنشاء الطلب");
      logActivity({
        module: "orders",
        action: initial ? "update" : "create",
        description: initial
          ? `تعديل طلب العميل ${info.name}`
          : `إنشاء طلب جديد للعميل ${info.name}`,
      });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const contactPickerSupported = typeof window !== "undefined"
    && "contacts" in navigator
    && typeof (navigator as any).contacts?.select === "function";

  async function pickFromContacts() {
    if (!contactPickerSupported) {
      setContactsUnavailable(true);
      toast.message("اختيار جهات الاتصال متاح فقط من تطبيق الهاتف", {
        description: "افتح التطبيق على هاتفك (Android/Chrome) لاستيراد جهة اتصال.",
      });
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(["name", "tel"], { multiple: false });
      if (!contacts || contacts.length === 0) return;
      const c = contacts[0];
      const name = Array.isArray(c.name) ? c.name[0] : c.name;
      const tel = Array.isArray(c.tel) ? c.tel[0] : c.tel;
      if (name) setNewName(String(name));
      if (tel) setNewPhone(String(tel).replace(/\s+/g, ""));
      // Clear any selected existing customer so the inline fields drive creation
      setCustomerId(null);
      setCustomerLabel("");
      setContactsUnavailable(false);
    } catch (e: any) {
      const msg = e?.message || "";
      const isUnavailable =
        msg.includes("security") ||
        msg.includes("iframe") ||
        msg.includes("InvalidStateError") ||
        msg.includes("not allowed") ||
        msg.includes("permission") ||
        e?.name === "SecurityError" ||
        e?.name === "InvalidStateError";
      if (isUnavailable) {
        setContactsUnavailable(true);
        return;
      }
      toast.error("تعذر فتح جهات الاتصال: " + (msg || "غير مدعوم"));
    }
  }


  return (
    <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{isEditing ? "تعديل الطلب" : "طلب جديد"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); createOrder.mutate(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>العميل</Label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="truncate">{customerLabel || "اختر عميلاً"}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="ابحث…" value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>لا نتائج</CommandEmpty>
                  <CommandGroup>
                    {filtered.map(c => (
                      <CommandItem key={c.id} onSelect={() => { setCustomerId(c.id); setCustomerLabel(`${c.name} — ${c.phone}`); setPickerOpen(false); }}>
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground mr-auto" dir="ltr">{c.phone}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">عميل جديد؟ أدخل بياناته أو اختره من جهات الاتصال</p>
            <Button type="button" variant="outline" size="sm" onClick={pickFromContacts} className="shrink-0">
              <Contact className="h-4 w-4 ml-1" />جهات الاتصال
            </Button>
          </div>
          {contactsUnavailable && (
            <p className="text-[11px] text-muted-foreground">
              اختيار جهات الاتصال متاح فقط عند فتح التطبيق مباشرة على الهاتف.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex gap-2">
              <Input placeholder="الاسم" value={newName} onChange={(e) => { setNewName(e.target.value); if (customerId) { setCustomerId(null); setCustomerLabel(""); } }} className="flex-1" />
            </div>
            <Input placeholder="الهاتف" value={newPhone} onChange={(e) => { setNewPhone(e.target.value); if (customerId) { setCustomerId(null); setCustomerLabel(""); } }} dir="ltr" />
          </div>
          <Button type="button" variant="secondary" size="sm" className="w-full"
            disabled={!newName || !newPhone || createCustomer.isPending}
            onClick={() => createCustomer.mutate()}>
            <Plus className="h-4 w-4 ml-1" />حفظ كعميل الآن (اختياري)
          </Button>
          <p className="text-[11px] text-muted-foreground">إن لم تحفظه الآن، سيتم حفظه تلقائياً عند حفظ الطلب.</p>
        </div>


        <div className="space-y-2">
          <Label>تفاصيل الطلب</Label>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="اكتب تفاصيل الطلب…" />
          <p className="text-[11px] text-muted-foreground">يمكنك الاكتفاء بالنص أو الصور أو التسجيل الصوتي</p>
        </div>

        <div className="space-y-2">
          <Label>مرفقات</Label>
          {isEditing && (initial?.images?.length || initial?.voice_note || initial?.files?.length) ? (
            <div className="rounded-lg border bg-muted/20 p-2">
              <OrderAttachmentsView images={initial.images} voice={initial.voice_note} files={initial.files} />
            </div>
          ) : null}
          <OrderAttachmentInput value={attachments} onChange={setAttachments} />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={createOrder.isPending || (!customerId && !(newName.trim() && newPhone.trim()))}>
            {createOrder.isPending ? "جارٍ الحفظ…" : "حفظ الطلب"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
