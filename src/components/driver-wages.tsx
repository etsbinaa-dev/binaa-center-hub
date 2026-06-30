import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DRIVERS = [
  { name: "بكرن", rates: { ciment_tonne: 1200, barig: 100, fer_tonne: 1000 } },
  { name: "الحسن", rates: { ciment_tonne: 1200, barig: 100, fer_tonne: 1000 } },
  { name: "موناك", rates: { ciment_tonne: 1000, barig: 100, fer_tonne: 1000 } },
];

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

export function DriverWages() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [results, setResults] = useState<DriverResult[]>([]);
  const [loading, setLoading] = useState(false);

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

      for (const driver of DRIVERS) {
        const driverOrders: DriverOrder[] = (orders ?? [])
          .filter((o: any) => o.driver_name === driver.name)
          .map((o: any) => ({ id: o.id, details: o.details ?? "" }));

        let quantities = { ciment_tonnes: 0, barigs: 0, fer_tonnes: 0 };
        if (driverOrders.length > 0) {
          quantities = await analyzeOrders(driverOrders);
        }

        const total =
          quantities.ciment_tonnes * driver.rates.ciment_tonne +
          quantities.barigs * driver.rates.barig +
          quantities.fer_tonnes * driver.rates.fer_tonne;

        driverResults.push({
          name: driver.name,
          ciment_tonnes: quantities.ciment_tonnes,
          barigs: quantities.barigs,
          fer_tonnes: quantities.fer_tonnes,
          total,
          rates: driver.rates,
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

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
          dir="ltr"
        />
        <Button onClick={calculate} disabled={loading}>
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
                <span className="text-sm text-muted-foreground">
                  {r.orders.length} توصيلة
                </span>
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
                    {r.barigs} × {r.rates.barig.toLocaleString()} ={" "}
                    {(r.barigs * r.rates.barig).toLocaleString()}
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
                  <summary className="cursor-pointer">
                    عرض التوصيلات ({r.orders.length})
                  </summary>
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
