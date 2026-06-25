import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Save, Loader2, X as XIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { sendTelegramAdminRaw } from "@/lib/telegram-alert.functions";

const DEFAULT_CRITICAL_THRESHOLD = 5;
const DEFAULT_LOW_STOCK_THRESHOLD = 50;

type Product = { key: string; label: string };
type Section = { category: string; title: string; items: Product[] };

const SECTIONS: Section[] = [
  {
    category: "turkish",
    title: "الحديد التركي",
    items: [
      { key: "fer_12_turkish", label: "فير 12 تركي" },
      { key: "fer_10_turkish", label: "فير 10 تركي" },
      { key: "fer_14_turkish", label: "فير 14 تركي" },
      { key: "fer_16_turkish", label: "فير 16 تركي" },
    ],
  },
  {
    category: "northern",
    title: "الحديد الشمالي",
    items: [
      { key: "fer_12_northern", label: "فير 12 شمالي" },
      { key: "fer_10_northern", label: "فير 10 شمالي" },
      { key: "fer_14_northern", label: "فير 14 شمالي" },
      { key: "fer_16_northern", label: "فير 16 شمالي" },
    ],
  },
  {
    category: "chinese",
    title: "الحديد الصيني",
    items: [
      { key: "fer_12_chinese", label: "فير 12 صيني" },
      { key: "fer_10_chinese", label: "فير 10 صيني" },
    ],
  },
  {
    category: "algerian",
    title: "الحديد الجزائري",
    items: [
      { key: "fer_12_algerian", label: "فير 12 جزائري" },
      { key: "fer_10_algerian", label: "فير 10 جزائري" },
      { key: "fer_14_algerian", label: "فير 14 جزائري" },
    ],
  },
  {
    category: "other",
    title: "أخرى",
    items: [
      { key: "fer_8", label: "فير 8" },
      { key: "fer_6_tam", label: "فير 6 تام" },
      { key: "fer_5", label: "فير 5" },
      { key: "fer_4", label: "فير 4" },
    ],
  },
];

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "الكميات — بِناء HUB" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    filter: search.filter === "critical" ? "critical" : undefined,
  }),
  component: QuantitiesPage,
});

function QuantitiesPage() {
  const { filter } = Route.useSearch();
  const criticalOnly = filter === "critical";
  const initial = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SECTIONS) for (const p of s.items) m[p.key] = 0;
    return m;
  }, []);

  const [values, setValues] = useState<Record<string, number>>(initial);
  const [previous, setPrevious] = useState<Record<string, number>>(initial);
  const [updatedAt, setUpdatedAt] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.category, true])),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedLow, setSavedLow] = useState<Record<string, boolean>>({});
  const [criticalThreshold, setCriticalThreshold] = useState<number>(DEFAULT_CRITICAL_THRESHOLD);
  const [lowThreshold, setLowThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("critical_quantity, low_stock_threshold")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        if (typeof (data as any).critical_quantity === "number") {
          setCriticalThreshold((data as any).critical_quantity);
        }
        if (typeof (data as any).low_stock_threshold === "number") {
          setLowThreshold((data as any).low_stock_threshold);
        }
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("quantities")
        .select("product_key, quantity, previous_quantity, updated_at");
      if (!error && data) {
        const low: Record<string, boolean> = {};
        const prevMap: Record<string, number> = {};
        const updMap: Record<string, string | null> = {};
        setValues((prev) => {
          const next = { ...prev };
          for (const r of data as Array<{ product_key: string; quantity: number | null; previous_quantity: number | null; updated_at: string | null }>) {
            if (r.product_key in next) {
              next[r.product_key] = r.quantity ?? 0;
              prevMap[r.product_key] = r.previous_quantity ?? 0;
              updMap[r.product_key] = r.updated_at;
              low[r.product_key] = (r.quantity ?? 0) <= criticalThreshold;
            }
          }
          return next;
        });
        setPrevious((p) => ({ ...p, ...prevMap }));
        setUpdatedAt(updMap);
        setSavedLow(low);
      }
      setLoading(false);
    })();
  }, []);

  const update = (key: string, raw: string) => {
    const n = raw === "" ? 0 : Math.max(0, parseInt(raw, 10) || 0);
    setValues((v) => ({ ...v, [key]: n }));
  };

  const save = async () => {
    setSaving(true);
    // snapshot: read current saved quantities + previous_quantity from DB
    const { data: current } = await supabase
      .from("quantities")
      .select("product_key, quantity, previous_quantity");
    const currentQty: Record<string, number> = {};
    const currentPrev: Record<string, number> = {};
    for (const r of (current ?? []) as Array<{
      product_key: string;
      quantity: number | null;
      previous_quantity: number | null;
    }>) {
      currentQty[r.product_key] = r.quantity ?? 0;
      currentPrev[r.product_key] = r.previous_quantity ?? 0;
    }
    const nextPrev: Record<string, number> = {};
    const rows = SECTIONS.flatMap((s) =>
      s.items.map((p) => {
        const newQty = values[p.key];
        const dbQty = currentQty[p.key] ?? 0;
        // only update previous_quantity when the new quantity differs from the saved one
        const prev = dbQty;
        nextPrev[p.key] = prev;
        return {
          product_key: p.key,
          label: p.label,
          category: s.category,
          quantity: newQty,
          previous_quantity: prev,
          min_quantity: lowThreshold,
        };
      }),
    );
    const { error } = await supabase.from("quantities").upsert(rows, { onConflict: "product_key" });
    setSaving(false);
    if (error) toast.error("تعذّر حفظ الكميات");
    else {
      toast.success("تم حفظ الكميات بنجاح");
      // Fire-and-forget Telegram inventory snapshot
      try {
        const allIron = SECTIONS.flatMap((s) =>
          s.items.map((p) => ({ label: p.label, qty: values[p.key] ?? 0 })),
        ).sort((a, b) => a.qty - b.qty);
        const getStatus = (qty: number) =>
          qty < 10
            ? { emoji: "🔴", label: "حرج" }
            : qty < 50
              ? { emoji: "🟡", label: "منخفض" }
              : { emoji: "🟢", label: "عادي" };
        const now = new Intl.DateTimeFormat("ar", {
          timeZone: "Africa/Nouakchott",
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date());
        const critical = allIron.filter((i) => i.qty < 10);
        const low      = allIron.filter((i) => i.qty >= 10 && i.qty < 50);
        const normal   = allIron.filter((i) => i.qty >= 50);

        // monospace row: pad label to 20 chars then qty
        const row = (label: string, qty: number) => {
          const padded = label.padEnd(20, " ");
          return `  ${padded} ${String(qty).padStart(4)} بريكة`;
        };

        const blockLines: string[] = [];

        if (critical.length > 0) {
          blockLines.push("🔴 ـــــ حرج ـــــ");
          critical.forEach((i) => blockLines.push(row(i.label, i.qty)));
        }
        if (low.length > 0) {
          blockLines.push("");
          blockLines.push("🟡 ـــ منخفض ـــ");
          low.forEach((i) => blockLines.push(row(i.label, i.qty)));
        }
        if (normal.length > 0) {
          blockLines.push("");
          blockLines.push("🟢 ـــ عادي ـــــ");
          normal.forEach((i) => blockLines.push(row(i.label, i.qty)));
        }

        // wrap in monospace code block for telegram
        const block = "```\n" + blockLines.join("\n") + "\n```";

        const tgText = [
          `📦 *مخزون الحديد*`,
          `🕒 ${escapeMd(now)}`,
          "",
          block,
        ].join("\n");
        void sendTelegramRaw({ data: { text: tgText } }).catch(() => {});
      } catch {
        /* ignore */
      }
      logActivity({ module: "inventory", action: "save", description: "حفظ الكميات اليومية" });
      setPrevious(nextPrev);
      const nowIso = new Date().toISOString();
      setUpdatedAt((u) => {
        const next = { ...u };
        for (const s of SECTIONS) for (const p of s.items) next[p.key] = nowIso;
        return next;
      });
      const newlyLow: { key: string; label: string }[] = [];
      const nextLow: Record<string, boolean> = {};
      for (const s of SECTIONS) {
        for (const p of s.items) {
          const isLow = values[p.key] <= criticalThreshold;
          nextLow[p.key] = isLow;
          if (isLow && !savedLow[p.key]) newlyLow.push(p);
        }
      }
      setSavedLow(nextLow);
      for (const p of newlyLow) {
        notify("low_stock", `تحذير: ${p.label} وصل إلى المخزون الحرج.`);
      }
    }
  };

  const fmtUpdated = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    const date = d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long" });
    const time = d.toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${date} ${time}`;
  };

  const displayedSections = criticalOnly
    ? (() => {
        const flat = SECTIONS.flatMap((s) =>
          s.items
            .filter((p) => (values[p.key] ?? 0) <= lowThreshold)
            .map((p) => ({ ...p, category: s.category })),
        );
        flat.sort((a, b) => {
          const qa = values[a.key] ?? 0;
          const qb = values[b.key] ?? 0;
          const ta = qa <= criticalThreshold ? 0 : 1;
          const tb = qb <= criticalThreshold ? 0 : 1;
          if (ta !== tb) return ta - tb;
          return qa - qb;
        });
        return flat.length
          ? [{ category: "critical-low", title: "المخزون الحرج والمنخفض", items: flat }]
          : [];
      })()
    : SECTIONS;

  return (
    <AppShell moduleKey="inventory" title="الكميات">
      <div className="mx-auto max-w-2xl space-y-4 pb-32">
        {criticalOnly && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-900">
            <span>المخزون الحرج والمنخفض</span>
            <Link
              to="/inventory"
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              <XIcon className="h-3.5 w-3.5" />
              إلغاء الفلتر
            </Link>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : displayedSections.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            لا توجد منتجات في المخزون الحرج حالياً.
          </div>
        ) : (
          displayedSections.map((s) => (
            <section
              key={s.category}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [s.category]: !o[s.category] }))}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition-colors hover:bg-muted/40"
              >
                <span className="text-base font-bold sm:text-lg">{s.title}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                    open[s.category] ? "rotate-180" : ""
                  }`}
                />
              </button>
              {(open[s.category] ?? criticalOnly) && (
                <div className="space-y-3 border-t border-border bg-muted/20 p-3 sm:p-4">
                  {[...s.items]
                    .sort((a, b) => {
                      const qa = values[a.key] ?? 0;
                      const qb = values[b.key] ?? 0;
                      const tier = (q: number) =>
                        q <= criticalThreshold ? 0 : q <= lowThreshold ? 1 : 2;
                      const ta = tier(qa);
                      const tb = tier(qb);
                      if (ta !== tb) return ta - tb;
                      return qa - qb;
                    })
                    .map((p) => {
                    const qty = values[p.key];
                    const critical = qty <= criticalThreshold;
                    const low = !critical && qty <= lowThreshold;
                    const tone = critical
                      ? "border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950"
                      : low
                        ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950"
                        : "border-border bg-card";
                    return (
                      <div
                        key={p.key}
                        className={`rounded-xl border p-4 shadow-sm transition-colors ${tone}`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold sm:text-base">{p.label}</h3>
                          {critical && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900 dark:text-red-200">
                              مخزون حرج
                            </span>
                          )}
                          {low && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              مخزون منخفض
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`q-${p.key}`} className="text-xs text-muted-foreground">
                            الكمية
                          </Label>
                          <Input
                            id={`q-${p.key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={qty}
                            onChange={(e) => update(p.key, e.target.value)}
                            className="text-center text-base font-semibold"
                          />
                          {(() => {
                            const prev = previous[p.key] ?? 0;
                            const diff = qty - prev;
                            const diffTone =
                              diff > 0
                                ? "text-green-600 dark:text-green-400"
                                : diff < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground";
                            const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
                            const upd = fmtUpdated(updatedAt[p.key]);
                            return (
                              <div className="mt-1.5 space-y-0.5 text-[11px] leading-tight text-muted-foreground">
                                <div className="flex items-center justify-between">
                                  <span>أمس:</span>
                                  <span className="font-medium tabular-nums">{prev}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>الفرق:</span>
                                  <span className={`font-semibold tabular-nums ${diffTone}`}>
                                    {arrow} {Math.abs(diff)}
                                  </span>
                                </div>
                                {upd && (
                                  <div className="pt-0.5 text-[10px] opacity-80">
                                    آخر تحديث: {upd}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          <Button
            onClick={save}
            disabled={saving || loading}
            className="h-14 w-full rounded-xl bg-green-600 text-base font-bold text-white shadow-lg hover:bg-green-700"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Save className="ms-2 h-5 w-5" />
                حفظ الكميات
              </>
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
