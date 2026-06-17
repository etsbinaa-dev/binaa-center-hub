import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Phone, Clock, CheckCircle2, Truck, PackageCheck, MessageCircle } from "lucide-react";
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
  customers: { id: string; name: string; phone: string } | null;
};

function normalizePhone(p: string) {
  return (p || "").replace(/[^\d+]/g, "");
}

export function DeliveryList({ view }: { view: "active" | "archive" }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading, isError, error } = useQuery<DeliveryOrder[], Error>({
    queryKey: ["delivery", view, search],
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id,details,created_at,delivery_status,images,files,voice_note,customers:customer_id(id,name,phone)")
        .eq("status", "archived");
      if (view === "archive") q = q.eq("delivery_status", "delivered");
      else q = q.in("delivery_status", ["new", "in_progress"]);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data as unknown as DeliveryOrder[]) ?? [];
      if (!search.trim()) return list;
      const s = search.toLowerCase();
      return list.filter(o =>
        o.customers?.name.toLowerCase().includes(s) ||
        o.customers?.phone.includes(s),
      );
    },
  });

  const updateDelivery = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: DeliveryStatus }) => {
      const order = orders.find((o) => o.id === id);
      const { error } = await supabase.from("orders").update({
        delivery_status: next,
        delivered_at: next === "delivered" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
      return order;
    },
    onSuccess: (order, vars) => {
      qc.invalidateQueries({ queryKey: ["delivery"] });
      qc.invalidateQueries({ queryKey: ["count"] });
      toast.success(
        vars.next === "delivered" ? "تم التسليم" :
        vars.next === "in_progress" ? "بدأ التوصيل" : "تم التحديث",
      );
      const cname = order?.customers?.name ?? "—";
      if (vars.next === "delivered") {
        logActivity({ module: "delivery", action: "delivered", description: `تأكيد تسليم طلب العميل ${cname}` });
      } else if (vars.next === "in_progress") {
        logActivity({ module: "delivery", action: "start_delivery", description: `بدء توصيل طلب العميل ${cname}` });
      }
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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف" className="pr-10" />
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
                      <Button size="sm" variant="secondary" onClick={() => updateDelivery.mutate({ id: o.id, next: "in_progress" })}>
                        <Truck className="h-4 w-4 ml-1" />بدء التوصيل
                      </Button>
                    )}
                    <Button size="sm" variant="default" onClick={() => updateDelivery.mutate({ id: o.id, next: "delivered" })}>
                      <PackageCheck className="h-4 w-4 ml-1" />تم التسليم
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
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
