import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Truck, ExternalLink, Pencil, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

type Vehicle = {
  id: string;
  name: string;
  tracking_url: string;
  url_updated_at: string | null;
};

function isUrlActive(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < 24 * 60 * 60 * 1000;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar", {
    timeZone: "Africa/Nouakchott",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function VehiclesTracker() {
  const { isAdmin } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase
      .from("vehicles")
      .select("id, name, tracking_url, url_updated_at")
      .order("id");
    setVehicles((data as Vehicle[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function saveName(v: Vehicle) {
    const name = editing[v.id + "_name"];
    if (!name?.trim()) return;
    await supabase.from("vehicles").update({ name: name.trim() }).eq("id", v.id);
    toast.success("تم حفظ الاسم");
    setEditing((s) => { const c = { ...s }; delete c[v.id + "_name"]; return c; });
    load();
  }

  async function saveUrl(v: Vehicle) {
    const url = editing[v.id + "_url"];
    if (!url?.trim()) return;
    await supabase.from("vehicles").update({
      tracking_url: url.trim(),
      url_updated_at: new Date().toISOString(),
    }).eq("id", v.id);
    toast.success("تم تحديث رابط التتبع");
    setEditing((s) => { const c = { ...s }; delete c[v.id + "_url"]; return c; });
    load();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Truck className="h-4 w-4" />
        تتبع السيارات
      </div>
      <div className="grid grid-cols-3 gap-2">
        {vehicles.map((v) => {
          const active = isUrlActive(v.url_updated_at);
          const isEditingName = editing[v.id + "_name"] != null;
          const isEditingUrl = editing[v.id + "_url"] != null;
          return (
            <div
              key={v.id}
              className={`rounded-lg border p-2 space-y-2 text-center ${
                active
                  ? "border-green-400 bg-green-50/30 dark:bg-green-950/20"
                  : "border-border"
              }`}
            >
              {/* الاسم */}
              {isAdmin && isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    className="w-full rounded border px-1 py-0.5 text-xs text-center"
                    value={editing[v.id + "_name"]}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s, [v.id + "_name"]: e.target.value }))
                    }
                  />
                  <button onClick={() => saveName(v)} className="text-green-600 shrink-0">
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() =>
                      setEditing((s) => {
                        const c = { ...s };
                        delete c[v.id + "_name"];
                        return c;
                      })
                    }
                    className="text-red-500 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs font-bold truncate">{v.name || v.id}</span>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        setEditing((s) => ({ ...s, [v.id + "_name"]: v.name }))
                      }
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {/* الحالة */}
              <div
                className={`text-[10px] font-bold ${
                  active ? "text-green-600" : "text-red-500"
                }`}
              >
                {active ? `🟢 نشط (${fmtTime(v.url_updated_at)})` : "🔴 منتهي"}
              </div>

              {/* زر التتبع */}
              {v.tracking_url ? (
                <a
                  href={v.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-white w-full justify-center ${
                    active
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ExternalLink className="h-3 w-3" /> تتبع
                </a>
              ) : (
                <div className="text-[10px] text-muted-foreground">لا يوجد رابط</div>
              )}

              {/* تحديث الرابط للمدير فقط */}
              {isAdmin &&
                (isEditingUrl ? (
                  <div className="space-y-1">
                    <input
                      autoFocus
                      className="w-full rounded border px-1 py-0.5 text-[10px]"
                      placeholder="رابط TrackSolid"
                      value={editing[v.id + "_url"]}
                      onChange={(e) =>
                        setEditing((s) => ({ ...s, [v.id + "_url"]: e.target.value }))
                      }
                      dir="ltr"
                    />
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => saveUrl(v)} className="text-green-600">
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() =>
                          setEditing((s) => {
                            const c = { ...s };
                            delete c[v.id + "_url"];
                            return c;
                          })
                        }
                        className="text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      setEditing((s) => ({ ...s, [v.id + "_url"]: v.tracking_url || "" }))
                    }
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Clock className="h-3 w-3" /> تحديث الرابط
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
