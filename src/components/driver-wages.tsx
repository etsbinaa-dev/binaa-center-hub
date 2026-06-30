import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

type Driver = {
  id: string;
  name: string;
  ciment_rate: number;
  barig_rate: number;
  fer_rate: number;
};

type DriverOrder = { id: string; details: string };
type DriverResult = {
  name: string;
  ciment_tonnes: number;
  barigs: number;
  fer_tonnes: number;
  total: number;
  rates: { ciment_tonne: number; barig: number; fer_tonne: number };
  orders: DriverOrder[];
};

async function analyzeOrders(
  orders: DriverOrder[],
): Promise<{ ciment_tonnes: number; barigs: number; fer_tonnes: number }> {
  const combined = orders.map((o) => o.details).filter(Boolean).join("\n---\n");
  if (!combined.trim()) return { ciment_tonnes: 0, barigs: 0, fer_tonnes: 0 };

  const { data, error } = await supabase.functions.invoke("gemini-driver-wages", {
    body: { details: combined },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return {
    ciment_tonnes: Number(data?.ciment_tonnes ?? 0),
    barigs: Number(data?.barigs ?? 0),
    fer_tonnes: Number(data?.fer_tonnes ?? 0),
  };
}

function DriverForm({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial?: Driver;
  onCancel: () => void;
  onSave: (values: { name: string; ciment_rate: number; barig_rate: number; fer_rate: number }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ciment, setCiment] = useState(String(initial?.ciment_rate ?? ""));
  const [barig, setBarig] = useState(String(initial?.barig_rate ?? ""));
  const [fer, setFer] = useState(String(initial?.fer_rate ?? ""));

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-1">
        <Label htmlFor="drv-name">اسم السائق</Label>
        <Input id="drv-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="drv-ciment">سعر طن السيمان</Label>
          <Input id="drv-ciment" type="number" value={ciment} onChange={(e) => setCiment(e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="drv-barig">سعر البريك</Label>
          <Input id="drv-barig" type="number" value={barig} onChange={(e) => setBarig(e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="drv-fer">سعر طن الحديد</Label>
          <Input id="drv-fer" type="number" value={fer} onChange={(e) => setFer(e.target.value)} dir="ltr" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={saving || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              ciment_rate: Number(ciment) || 0,
              barig_rate: Number(barig) || 0,
              fer_rate: Number(fer) || 0,
            })
          }
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}

function DriversManager({
  drivers,
  loading,
  onRefresh,
}: {
  drivers: Driver[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd(values: { name: string; ciment_rate: number; barig_rate: number; fer_rate: number }) {
    setSavingId("new");
    const { error } = await supabase.from("drivers").insert(values);
    setSavingId(null);
    if (error) {
      toast.error("فشل إضافة السائق: " + error.message);
      return;
    }
    toast.success("تمت إضافة السائق");
    setAdding(false);
    onRefresh();
  }

  async function handleEdit(
    id: string,
    values: { name: string; ciment_rate: number; barig_rate: number; fer_rate: number },
  ) {
    setSavingId(id);
    const { error } = await supabase.from("drivers").update(values).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("فشل تعديل السائق: " + error.message);
      return;
    }
    toast.success("تم تحديث بيانات السائق");
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(driver: Driver) {
    if (!window.confirm(`هل تريد حذف السائق "${driver.name}"؟`)) return;
    setBusyId(driver.id);
    const { error } = await supabase.from("drivers").delete().eq("id", driver.id);
    setBusyId(null);
    if (error) {
      toast.error("فشل الحذف: " + error.message);
      return;
    }
    toast.success("تم حذف السائق");
    onRefresh();
  }

  return (
    <Card className="p-4">
      <button className="flex w-full items-center justify-between text-start" onClick={() => setOpen((o) => !o)}>
        <h3 className="text-lg font-bold">إدارة السائقين</h3>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            drivers.map((d) =>
              editingId === d.id ? (
                <DriverForm
                  key={d.id}
                  initial={d}
                  saving={savingId === d.id}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => handleEdit(d.id, values)}
                />
              ) : (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-bold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      سيمان {d.ciment_rate.toLocaleString()} · بريك {d.barig_rate.toLocaleString()} · حديد{" "}
                      {d.fer_rate.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => setEditingId(d.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" disabled={busyId === d.id} onClick={() => handleDelete(d)}>
                      {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ),
            )
          )}

          {adding ? (
            <DriverForm saving={savingId === "new"} onCancel={() => setAdding(false)} onSave={handleAdd} />
          ) : (
            <Button size="sm" onClick={() => setAdding(true)}>
              إضافة سائق
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function DriverWages() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [results, setResults] = useState<DriverResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);

  async function loadDrivers() {
    setDriversLoading(true);
    const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: true });
    setDriversLoading(false);
    if (error) {
      toast.error("فشل تحميل قائمة السائقين: " + error.message);
      return;
    }
    setDrivers((data ?? []) as Driver[]);
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  async function calculate() {
    setLoading(true);
    setResults([]);
    try {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, details, driver_name, delivered_at, created_at")
        .eq("delivery_status", "delivered")
        .gte("delivered_at", startOfDay)
        .lte("delivered_at", endOfDay);

      if (error) throw error;

      const driverResults: DriverResult[] = [];

      for (const driver of drivers) {
        const driverOrders: DriverOrder[] = (orders ?? [])
          .filter((o: any) => o.driver_name === driver.name)
          .map((o: any) => ({ id: o.id, details: o.details ?? "" }));

        let quantities = { ciment_tonnes: 0, barigs: 0, fer_tonnes: 0 };
        if (driverOrders.length > 0) {
          quantities = await analyzeOrders(driverOrders);
        }

        const rates = {
          ciment_tonne: driver.ciment_rate,
          barig: driver.barig_rate,
          fer_tonne: driver.fer_rate,
        };

        const total =
          quantities.ciment_tonnes * rates.ciment_tonne +
          quantities.barigs * rates.barig +
          quantities.fer_tonnes * rates.fer_tonne;

        driverResults.push({
          name: driver.name,
          ciment_tonnes: quantities.ciment_tonnes,
          barigs: quantities.barigs,
          fer_tonnes: quantities.fer_tonnes,
          total,
          rates,
          orders: driverOrders,
        });
      }

      setResults(driverResults);
    } catch (e: any) {
      toast.error("فشل الحساب: " + (e?.message ?? "خطأ"));
    } finally {
      setLoading(false);
    }
  }

  const grandTotal = results.reduce((sum, r) => sum + r.total, 0);

  return (
    <div dir="rtl" className="space-y-6">
      <h2 className="text-xl font-bold">مستحقات السائقين</h2>

      <DriversManager drivers={drivers} loading={driversLoading} onRefresh={loadDrivers} />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
          dir="ltr"
          lang="en"
          style={{ direction: "ltr", unicodeBidi: "isolate" }}
        />
        <Button onClick={calculate} disabled={loading || driversLoading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          حساب
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((r) => (
            <Card key={r.name} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{r.name}</h3>
                <span className="text-sm text-muted-foreground">{r.orders.length} توصيلة</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border/40 pb-1">
                  <span>سيمان</span>
                  <span>
                    {r.ciment_tonnes} طن × {r.rates.ciment_tonne.toLocaleString()} ={" "}
                    {(r.ciment_tonnes * r.rates.ciment_tonne).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-1">
                  <span>باريكات حديد</span>
                  <span>
                    {r.barigs} × {r.rates.barig.toLocaleString()} = {(r.barigs * r.rates.barig).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-1">
                  <span>حديد (طن)</span>
                  <span>
                    {r.fer_tonnes} طن × {r.rates.fer_tonne.toLocaleString()} ={" "}
                    {(r.fer_tonnes * r.rates.fer_tonne).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between rounded-lg bg-primary/10 p-3 font-bold">
                <span>المجموع</span>
                <span>{r.total.toLocaleString()} MRO</span>
              </div>

              {r.orders.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">عرض التوصيلات ({r.orders.length})</summary>
                  <ul className="mt-2 space-y-1 ps-4">
                    {r.orders.map((o, i) => (
                      <li key={o.id}>
                        {i + 1}. {o.details?.slice(0, 80)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          ))}

          <Card className="p-4 bg-primary text-primary-foreground">
            <div className="flex justify-between text-lg font-bold">
              <span>المجموع الكلي</span>
              <span>{grandTotal.toLocaleString()} MRO</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
