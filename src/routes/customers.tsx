import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Phone, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "العملاء — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="customers" title="العملاء">
      <RequireAuth>
        <CustomersPage />
      </RequireAuth>
    </AppShell>
  ),
});

type Customer = { id: string; name: string; phone: string; created_at: string };

function CustomersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: async () => {
      let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Customer[];
    },
  });

  const save = useMutation({
    mutationFn: async (vals: { name: string; phone: string; id?: string }) => {
      if (vals.id) {
        const { error } = await supabase.from("customers").update({ name: vals.name, phone: vals.phone }).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ name: vals.name, phone: vals.phone });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["count", "customers"] });
      setOpen(false); setEditing(null);
      toast.success(vars.id ? "تم تحديث بيانات العميل" : "تم إضافة العميل");
    },
    onError: () => toast.error("تعذر حفظ بيانات العميل"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["count", "customers"] });
      toast.success("تم حذف العميل");
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "") + String(e?.details ?? "");
      if (e?.code === "23503" || /foreign key|orders_customer_id_fkey/i.test(msg)) {
        toast.error("لا يمكن حذف العميل لأنه مرتبط بطلبات موجودة.");
      } else {
        toast.error("تعذر حذف العميل");
      }
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">العملاء</h2>
          <p className="text-sm text-muted-foreground">{customers.length} عميل</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة</Button>
          </DialogTrigger>
          <CustomerDialog
            key={editing?.id ?? "new"}
            initial={editing}
            onSubmit={(v) => save.mutate({ ...v, id: editing?.id })}
            loading={save.isPending}
          />
        </Dialog>
      </div>


      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف" className="pr-10" />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل…</p>
      ) : customers.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا يوجد عملاء</Card>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Card key={c.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                  <Phone className="h-3 w-3" />{c.phone}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف العميل؟</AlertDialogTitle>
                        <AlertDialogDescription>لا يمكن التراجع. لا يمكن الحذف إذا كان لديه طلبات.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(c.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerDialog({ initial, onSubmit, loading }: { initial: Customer | null; onSubmit: (v: { name: string; phone: string }) => void; loading: boolean; }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  return (
    <DialogContent dir="rtl">
      <DialogHeader>
        <DialogTitle>{initial ? "تعديل عميل" : "إضافة عميل"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, phone }); }} className="space-y-3">
        <div className="space-y-2">
          <Label>الاسم</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>رقم الهاتف</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ…" : "حفظ"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
