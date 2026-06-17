import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Search,
  ShieldCheck,
  Clock,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_MODULE_LABELS,
  type ActivityAction,
  type ActivityModule,
} from "@/lib/activity";

export const Route = createFileRoute("/activity")({
  head: () => ({ meta: [{ title: "سجل النشاط — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="settings" title="سجل النشاط">
      <ActivityPage />
    </AppShell>
  ),
});

type LogRow = {
  id: string;
  user_name: string;
  user_role: string | null;
  module: string;
  action: string;
  description: string;
  created_at: string;
};

type RangeKey = "today" | "week" | "month" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "all", label: "الكل" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "المدير",
  accountant: "المحاسب",
  delivery: "مسؤول التوصيل",
  monitor: "المراقب",
  employee: "موظف",
};

const MODULE_COLORS: Record<string, string> = {
  orders: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  invoices: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  delivery: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  customers: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  inventory: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  users: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  settings: "bg-muted text-muted-foreground",
};

function rangeStart(r: RangeKey): Date | null {
  const d = new Date();
  if (r === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (r === "week") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (r === "month") {
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return null;
}

function ActivityPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("week");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let q = supabase
        .from("activity_logs")
        .select("id,user_name,user_role,module,action,description,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const start = rangeStart(range);
      if (start) q = q.gte("created_at", start.toISOString());
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError(error.message);
      else setLogs((data ?? []) as LogRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter((l) => {
      const action =
        ACTIVITY_ACTION_LABELS[l.action as ActivityAction] ?? l.action;
      const mod = ACTIVITY_MODULE_LABELS[l.module as ActivityModule] ?? l.module;
      return (
        l.user_name.toLowerCase().includes(s) ||
        action.toLowerCase().includes(s) ||
        mod.toLowerCase().includes(s) ||
        l.description.toLowerCase().includes(s)
      );
    });
  }, [logs, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">سجل النشاط</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            سجل العمليات المهمة داخل بِناء HUB. للقراءة فقط.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم المستخدم أو نوع العملية…"
          className="w-full rounded-2xl border border-input bg-card py-3 ps-10 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
              range === r.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          جاري التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          لا توجد نشاطات ضمن المعايير الحالية.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => {
            const dt = new Date(l.created_at);
            const date = dt.toLocaleDateString("ar-EG", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const time = dt.toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const moduleLabel =
              ACTIVITY_MODULE_LABELS[l.module as ActivityModule] ?? l.module;
            const actionLabel =
              ACTIVITY_ACTION_LABELS[l.action as ActivityAction] ?? l.action;
            const roleLabel =
              (l.user_role && ROLE_LABELS[l.user_role]) || l.user_role || "—";
            return (
              <article
                key={l.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        MODULE_COLORS[l.module] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {moduleLabel}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground">
                      {actionLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {time}
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">
                  {l.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {l.user_name}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {roleLabel}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {date}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
