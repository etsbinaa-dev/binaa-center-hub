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
  reception_ciment_rate: number;
  reception_barig_rate: number;
  reception_fer_rate: number;
};

type DriverFormValues = {
  name: string;
  ciment_rate: number;
  barig_rate: number;
  fer_rate: number;
  reception_ciment_rate: number;
  reception_barig_rate: number;
  reception_fer_rate: number;
};

type ExtraMaterial = {
  id: string;
  name: string;
  keywords: string[];
  price_tonne: number;
  price_unit: number;
};

type GeminiResult = {
  ciment_tonnes: number;
  barigs: number;
  fer_tonnes: number;
  plater_tonnes: number;
  plater_units: number;
  tachinti_units: number;
  flycont_units: number;
  coulcro_tonnes: number;
  coulcro_units: number;
  vilas_units: number;
};

type ExtraResult = {
  material: ExtraMaterial;
  tonnes: number;
  units: number;
  total: number;
};

type DriverOrder = { id: string; details: string };
type ReceptionItem = {
  id: string;
  supplier: string;
  goods_type: string;
  quantity: number;
  unit: string;
  created_at: string;
};

type DriverResult = {
  name: string;
  ciment_tonnes: number;
  barigs: number;
  fer_tonnes: number;
  deliveryRates: { ciment_tonne: number; barig: number; fer_tonne: number };
  deliveryTotal: number;
  orders: DriverOrder[];
  recCiment: number;
  recBarigs: number;
  recFer: number;
  receptionRates: { ciment_tonne: number; barig: number; fer_tonne: number };
  receptionTotal: number;
  receptions: ReceptionItem[];
  extras: ExtraResult[];
  extrasTotal: number;
  total: number;
};

const MATERIAL_KEY_MAP: Record<string, { tonnesKey: keyof GeminiResult; unitsKey: keyof GeminiResult }> = {
  "بلاتر": { tonnesKey: "plater_tonnes", unitsKey: "plater_units" },
  "تانشتي": { tonnesKey: "tachinti_units", unitsKey: "tachinti_units" },
  "فليكونت": { tonnesKey: "flycont_units", unitsKey: "flycont_units" },
  "كول كرو": { tonnesKey: "coulcro_tonnes", unitsKey: "coulcro_units" },
  "فيلاص": { tonnesKey: "vilas_units", unitsKey: "vilas_units" },
};

async function analyzeOrders(orders: DriverOrder[]): Promise<GeminiResult> {
  const empty: GeminiResult = { ciment_tonnes: 0, barigs: 0, fer_tonnes: 0, plater_tonnes: 0, plater_units: 0, tachinti_units: 0, flycont_units: 0, coulcro_tonnes: 0, coulcro_units: 0, vilas_units: 0 };
  const combined = orders.map(o => o.details).filter(Boolean).join("\n---\n");
  if (!combined.trim()) return empty;
  const { data, error } = await supabase.functions.invoke("gemini-driver-wages", { body: { details: combined } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    ciment_tonnes: Number(data?.ciment_tonnes ?? 0),
    barigs: Number(data?.barigs ?? 0),
    fer_tonnes: Number(data?.fer_tonnes ?? 0),
    plater_tonnes: Number(data?.plater_tonnes ?? 0),
    plater_units: Number(data?.plater_units ?? 0),
    tachinti_units: Number(data?.tachinti_units ?? 0),
    flycont_units: Number(data?.flycont_units ?? 0),
    coulcro_tonnes: Number(data?.coulcro_tonnes ?? 0),
    coulcro_units: Number(data?.coulcro_units ?? 0),
    vilas_units: Number(data?.vilas_units ?? 0),
  };
}

function classifyReception(r: ReceptionItem): { ciment: number; barig: number; fer: number } {
  const qty = Number(r.quantity) || 0;
  const goods = (r.goods_type || "").trim();
  if (r.unit === "قطعة") return { ciment: 0, barig: qty, fer: 0 };
  if (goods.includes("سيمان") || goods.includes("اسمنت") || goods.includes("إسمنت")) return { ciment: qty, barig: 0, fer: 0 };
  return { ciment: 0, barig: 0, fer: qty };
}

function getExtrasFromGemini(result: GeminiResult, materials: ExtraMaterial[]): ExtraResult[] {
  const extras: ExtraResult[] = [];
  for (const mat of materials) {
    const keys = MATERIAL_KEY_MAP[mat.name];
    if (!keys) continue;
    const isSameKey = keys.tonnesKey === keys.unitsKey;
    const tonnes = isSameKey ? 0 : Number(result[keys.tonnesKey] ?? 0);
    const units = isSameKey ? Number(result[keys.unitsKey] ?? 0) : Number(result[keys.unitsKey] ?? 0);
    const total = tonnes * mat.price_tonne + units * mat.price_unit;
    if (total > 0 || tonnes > 0 || units > 0) {
      extras.push({ material: mat, tonnes, units, total });
    }
  }
  return extras;
}

function MaterialForm({ initial, onCancel, onSave, saving }: {
  initial?: ExtraMaterial;
  onCancel: () => void;
  onSave: (v: { name: string; keywords: string[]; price_tonne: number; price_unit: number }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [keywords, setKeywords] = useState(initial?.keywords.join(", ") ?? "");
  const [priceTonne, setPriceTonne] = useState(String(initial?.price_tonne ?? ""));
  const [priceUnit, setPriceUnit] = useState(String(initial?.price_unit ?? ""));
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>اسم المادة</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>كلمات التعرف</Label><Input value={keywords} onChange={e => setKeywords(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>سعر الطن</Label><Input type="number" value={priceTonne} onChange={e => setPriceTonne(e.target.value)} dir="ltr" /></div>
        <div className="space-y-1"><Label>سعر القطعة</Label><Input type="number" value={priceUnit} onChange={e => setPriceUnit(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving || !name.trim()} onClick={() => onSave({ name: name.trim(), keywords: keywords.split(",").map(k => k.trim()).filter(Boolean), price_tonne: Number(priceTonne) || 0, price_unit: Number(priceUnit) || 0 })}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>إلغاء</Button>
      </div>
    </div>
  );
}

function ExtraMaterialsManager({ materials, loading, onRefresh }: { materials: ExtraMaterial[]; loading: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSave(id: string | null, values: { name: string; keywords: string[]; price_tonne: number; price_unit: number }) {
    setSavingId(id ?? "new");
    if (id) {
      const { error } = await supabase.from("extra_materials").update(values).eq("id", id);
      setSavingId(null);
      if (error) { toast.error("فشل التعديل: " + error.message); return; }
      toast.success("تم تحديث المادة"); setEditingId(null);
    } else {
      const { error } = await supabase.from("extra_materials").insert(values);
      setSavingId(null);
      if (error) { toast.error("فشل الإضافة: " + error.message); return; }
      toast.success("تمت إضافة المادة"); setAdding(false);
    }
    onRefresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`هل تريد حذف "${name}"؟`)) return;
    setBusyId(id);
    const { error } = await supabase.from("extra_materials").delete().eq("id", id);
    setBusyId(null);
    if (error) { toast.error("فشل الحذف: " + error.message); return; }
    toast.success("تم الحذف"); onRefresh();
  }

  return (
    <Card className="p-4">
      <button className="flex w-full items-center justify-between text-start" onClick={() => setOpen(o => !o)}>
        <h3 className="text-lg font-bold">إدارة المواد الإضافية</h3>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {loading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            materials.map(m => editingId === m.id ? (
              <MaterialForm key={m.id} initial={m} saving={savingId === m.id} onCancel={() => setEditingId(null)} onSave={v => handleSave(m.id, v)} />
            ) : (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-bold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">طن: {m.price_tonne.toLocaleString()} · قطعة: {m.price_unit.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground opacity-60">{m.keywords.join(" · ")}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => setEditingId(m.id)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" disabled={busyId === m.id} onClick={() => handleDelete(m.id, m.name)}>
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
          {adding ? <MaterialForm saving={savingId === "new"} onCancel={() => setAdding(false)} onSave={v => handleSave(null, v)} /> : (
            <Button size="sm" onClick={() => setAdding(true)}>إضافة مادة</Button>
          )}
        </div>
      )}
    </Card>
  );
}

function DriverForm({ initial, onCancel, onSave, saving }: { initial?: Driver; onCancel: () => void; onSave: (v: DriverFormValues) => void; saving: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ciment, setCiment] = useState(String(initial?.ciment_rate ?? ""));
  const [barig, setBarig] = useState(String(initial?.barig_rate ?? ""));
  const [fer, setFer] = useState(String(initial?.fer_rate ?? ""));
  const [recCiment, setRecCiment] = useState(String(initial?.reception_ciment_rate ?? ""));
  const [recBarig, setRecBarig] = useState(String(initial?.reception_barig_rate ?? ""));
  const [recFer, setRecFer] = useState(String(initial?.reception_fer_rate ?? ""));
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-1"><Label>اسم السائق</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="text-xs font-bold text-muted-foreground">أسعار التوصيل (للعميل)</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label>سعر طن السيمان</Label><Input type="number" value={ciment} onChange={e => setCiment(e.target.value)} dir="ltr" /></div>
        <div className="space-y-1"><Label>سعر البريك</Label><Input type="number" value={barig} onChange={e => setBarig(e.target.value)} dir="ltr" /></div>
        <div className="space-y-1"><Label>سعر طن الحديد</Label><Input type="number" value={fer} onChange={e => setFer(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="border-t border-border pt-3">
        <div className="mb-1 text-xs font-bold text-muted-foreground">أسعار الاستقبال (من المورد)</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1"><Label>سعر طن السيمان</Label><Input type="number" value={recCiment} onChange={e => setRecCiment(e.target.value)} dir="ltr" /></div>
          <div className="space-y-1"><Label>سعر القطعة</Label><Input type="number" value={recBarig} onChange={e => setRecBarig(e.target.value)} dir="ltr" /></div>
          <div className="space-y-1"><Label>سعر طن الحديد</Label><Input type="number" value={recFer} onChange={e => setRecFer(e.target.value)} dir="ltr" /></div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving || !name.trim()} onClick={() => onSave({ name: name.trim(), ciment_rate: Number(ciment) || 0, barig_rate: Number(barig) || 0, fer_rate: Number(fer) || 0, reception_ciment_rate: Number(recCiment) || 0, reception_barig_rate: Number(recBarig) || 0, reception_fer_rate: Number(recFer) || 0 })}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>إلغاء</Button>
      </div>
    </div>
  );
}

function DriversManager({ drivers, loading, onRefresh }: { drivers: Driver[]; loading: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd(values: DriverFormValues) {
    setSavingId("new");
    const { error } = await supabase.from("drivers").insert(values);
    setSavingId(null);
    if (error) { toast.error("فشل إضافة السائق: " + error.message); return; }
    toast.success("تمت إضافة السائق"); setAdding(false); onRefresh();
  }

  async function handleEdit(id: string, values: DriverFormValues) {
    setSavingId(id);
    const { error } = await supabase.from("drivers").update(values).eq("id", id);
    setSavingId(null);
    if (error) { toast.error("فشل تعديل السائق: " + error.message); return; }
    toast.success("تم تحديث بيانات السائق"); setEditingId(null); onRefresh();
  }

  async function handleDelete(driver: Driver) {
    if (!window.confirm(`هل تريد حذف السائق "${driver.name}"؟`)) return;
    setBusyId(driver.id);
    const { error } = await supabase.from("drivers").delete().eq("id", driver.id);
    setBusyId(null);
    if (error) { toast.error("فشل الحذف: " + error.message); return; }
    toast.success("تم حذف السائق"); onRefresh();
  }

  return (
    <Card className="p-4">
      <button className="flex w-full items-center justify-between text-start" onClick={() => setOpen(o => !o)}>
        <h3 className="text-lg font-bold">إدارة السائقين</h3>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {loading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
            drivers.map(d => editingId === d.id ? (
              <DriverForm key={d.id} initial={d} saving={savingId === d.id} onCancel={() => setEditingId(null)} onSave={v => handleEdit(d.id, v)} />
            ) : (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-bold">{d.name}</div>
                  <div className="text-xs text-muted-foreground">توصيل: سيمان {d.ciment_rate.toLocaleString()} · بريك {d.barig_rate.toLocaleString()} · حديد {d.fer_rate.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">استقبال: سيمان {d.reception_ciment_rate.toLocaleString()} · قطعة {d.reception_barig_rate.toLocaleString()} · حديد {d.reception_fer_rate.toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => setEditingId(d.id)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" disabled={busyId === d.id} onClick={() => handleDelete(d)}>
                    {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
          {adding ? <DriverForm saving={savingId === "new"} onCancel={() => setAdding(false)} onSave={handleAdd} /> : (
            <Button size="sm" onClick={() => setAdding(true)}>إضافة سائق</Button>
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
  const [extraMaterials, setExtraMaterials] = useState<ExtraMaterial[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);

  async function loadDrivers() {
    setDriversLoading(true);
    const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: true });
    setDriversLoading(false);
    if (error) { toast.error("فشل تحميل السائقين: " + error.message); return; }
    setDrivers((data ?? []) as Driver[]);
  }

  async function loadExtraMaterials() {
    setExtrasLoading(true);
    const { data, error } = await supabase.from("extra_materials").select("*").order("created_at", { ascending: true });
    setExtrasLoading(false);
    if (error) { toast.error("فشل تحميل المواد الإضافية: " + error.message); return; }
    setExtraMaterials((data ?? []) as ExtraMaterial[]);
  }

  useEffect(() => { loadDrivers(); loadExtraMaterials(); }, []);

  async function calculate() {
    setLoading(true);
    setResults([]);
    try {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      const { data: orders, error } = await supabase.from("orders").select("id, details, driver_name, delivered_at").eq("delivery_status", "delivered").gte("delivered_at", startOfDay).lte("delivered_at", endOfDay);
      if (error) throw error;

      const { data: receptions, error: recError } = await supabase.from("receptions").select("id, supplier, goods_type, quantity, unit, driver_name, created_at").eq("brought_by_driver", true).gte("created_at", startOfDay).lte("created_at", endOfDay);
      if (recError) throw recError;

      const driverResults: DriverResult[] = [];

      for (const driver of drivers) {
        const driverOrders: DriverOrder[] = (orders ?? []).filter((o: any) => o.driver_name === driver.name).map((o: any) => ({ id: o.id, details: o.details ?? "" }));

        const empty: GeminiResult = { ciment_tonnes: 0, barigs: 0, fer_tonnes: 0, plater_tonnes: 0, plater_units: 0, tachinti_units: 0, flycont_units: 0, coulcro_tonnes: 0, coulcro_units: 0, vilas_units: 0 };
        let gemini = empty;
        if (driverOrders.length > 0) gemini = await analyzeOrders(driverOrders);

        const deliveryRates = { ciment_tonne: driver.ciment_rate, barig: driver.barig_rate, fer_tonne: driver.fer_rate };
        const deliveryTotal = gemini.ciment_tonnes * deliveryRates.ciment_tonne + gemini.barigs * deliveryRates.barig + gemini.fer_tonnes * deliveryRates.fer_tonne;

        const driverReceptions: ReceptionItem[] = (receptions ?? []).filter((r: any) => r.driver_name === driver.name).map((r: any) => ({ id: r.id, supplier: r.supplier, goods_type: r.goods_type, quantity: Number(r.quantity) || 0, unit: r.unit, created_at: r.created_at }));

        let recCiment = 0, recBarigs = 0, recFer = 0;
        for (const r of driverReceptions) { const c = classifyReception(r); recCiment += c.ciment; recBarigs += c.barig; recFer += c.fer; }

        const receptionRates = { ciment_tonne: driver.reception_ciment_rate, barig: driver.reception_barig_rate, fer_tonne: driver.reception_fer_rate };
        const receptionTotal = recCiment * receptionRates.ciment_tonne + recBarigs * receptionRates.barig + recFer * receptionRates.fer_tonne;

        const extras = getExtrasFromGemini(gemini, extraMaterials);
        const extrasTotal = extras.reduce((s, e) => s + e.total, 0);

        driverResults.push({
          name: driver.name,
          ciment_tonnes: gemini.ciment_tonnes, barigs: gemini.barigs, fer_tonnes: gemini.fer_tonnes,
          deliveryRates, deliveryTotal, orders: driverOrders,
          recCiment, recBarigs, recFer,
          receptionRates, receptionTotal, receptions: driverReceptions,
          extras, extrasTotal,
          total: deliveryTotal + receptionTotal + extrasTotal,
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
      <ExtraMaterialsManager materials={extraMaterials} loading={extrasLoading} onRefresh={loadExtraMaterials} />
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-48" dir="ltr" lang="en" style={{ direction: "ltr", unicodeBidi: "isolate" }} />
        <Button onClick={calculate} disabled={loading || driversLoading || extrasLoading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}حساب
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(r => (
            <Card key={r.name} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{r.name}</h3>
                <span className="text-sm text-muted-foreground">{r.orders.length} توصيلة · {r.receptions.length} استقبال</span>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="text-sm font-bold">التوصيل</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-border/40 pb-1"><span>سيمان</span><span dir="ltr">{r.ciment_tonnes} طن × {r.deliveryRates.ciment_tonne.toLocaleString()} = {(r.ciment_tonnes * r.deliveryRates.ciment_tonne).toLocaleString()}</span></div>
                  <div className="flex justify-between border-b border-border/40 pb-1"><span>باريكات حديد</span><span dir="ltr">{r.barigs} × {r.deliveryRates.barig.toLocaleString()} = {(r.barigs * r.deliveryRates.barig).toLocaleString()}</span></div>
                  <div className="flex justify-between border-b border-border/40 pb-1"><span>حديد (طن)</span><span dir="ltr">{r.fer_tonnes} طن × {r.deliveryRates.fer_tonne.toLocaleString()} = {(r.fer_tonnes * r.deliveryRates.fer_tonne).toLocaleString()}</span></div>
                </div>
                <div className="flex justify-between text-sm font-bold"><span>مجموع التوصيل</span><span dir="ltr">{r.deliveryTotal.toLocaleString()} MRO</span></div>
                {r.orders.length > 0 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">عرض التوصيلات ({r.orders.length})</summary>
                    <ul className="mt-2 space-y-1 ps-4">{r.orders.map((o, i) => <li key={o.id} style={{ direction: "ltr", textAlign: "left" }}>{i + 1}. {o.details?.slice(0, 100)}</li>)}</ul>
                  </details>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="text-sm font-bold">الاستقبال (من المورد)</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-border/40 pb-1"><span>سيمان</span><span dir="ltr">{r.recCiment} طن × {r.receptionRates.ciment_tonne.toLocaleString()} = {(r.recCiment * r.receptionRates.ciment_tonne).toLocaleString()}</span></div>
                  <div className="flex justify-between border-b border-border/40 pb-1"><span>قطع</span><span dir="ltr">{r.recBarigs} × {r.receptionRates.barig.toLocaleString()} = {(r.recBarigs * r.receptionRates.barig).toLocaleString()}</span></div>
                  <div className="flex justify-between border-b border-border/40 pb-1"><span>حديد (طن)</span><span dir="ltr">{r.recFer} طن × {r.receptionRates.fer_tonne.toLocaleString()} = {(r.recFer * r.receptionRates.fer_tonne).toLocaleString()}</span></div>
                </div>
                <div className="flex justify-between text-sm font-bold"><span>مجموع الاستقبال</span><span dir="ltr">{r.receptionTotal.toLocaleString()} MRO</span></div>
                {r.receptions.length > 0 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">عرض الاستقبالات ({r.receptions.length})</summary>
                    <ul className="mt-2 space-y-1 ps-4">{r.receptions.map((rec, i) => <li key={rec.id} dir="auto">{i + 1}. {rec.supplier} — {rec.goods_type} — {rec.quantity} {rec.unit}</li>)}</ul>
                  </details>
                )}
              </div>

              {r.extras.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <div className="text-sm font-bold">مواد إضافية</div>
                  <div className="space-y-2 text-sm">
                    {r.extras.map(ex => (
                      <div key={ex.material.id} className="flex justify-between border-b border-border/40 pb-1">
                        <span>{ex.material.name}</span>
                        <span dir="ltr">
                          {ex.tonnes > 0 && `${ex.tonnes} طن × ${ex.material.price_tonne.toLocaleString()}`}
                          {ex.tonnes > 0 && ex.units > 0 && " + "}
                          {ex.units > 0 && `${ex.units} قطعة × ${ex.material.price_unit.toLocaleString()}`}
                          {" = "}{ex.total.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-bold"><span>مجموع المواد الإضافية</span><span dir="ltr">{r.extrasTotal.toLocaleString()} MRO</span></div>
                </div>
              )}

              <div className="flex justify-between rounded-lg bg-primary/10 p-3 font-bold">
                <span>المجموع الكلي للسائق</span><span dir="ltr">{r.total.toLocaleString()} MRO</span>
              </div>
            </Card>
          ))}
          <Card className="p-4 bg-primary text-primary-foreground">
            <div className="flex justify-between text-lg font-bold"><span>المجموع الكلي</span><span dir="ltr">{grandTotal.toLocaleString()} MRO</span></div>
          </Card>
        </div>
      )}
    </div>
  );
}
