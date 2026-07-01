import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList,
  Archive,
  Receipt,
  Send,
  CheckCircle2,
  Truck,
  PackageCheck,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getReports } from "@/lib/reports.functions";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "التقارير — بِناء HUB" }] }),
  component: ReportsPage,
});

type Range = "today" | "week" | "month";

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
];

function ReportsPage() {
  return (
    <AppShell moduleKey="reports" title="التقارير">
      <ReportsView />
    </AppShell>
  );
}

function ReportsView() {
  const [range, setRange] = useState<Range>("today");
  const fetchReports = useServerFn(getReports);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", range],
    queryFn: () => fetchReports({ data: { range } }),
  });

  type CardKey = "newOrders" | "archivedOrders" | "invoicedOrders" | "unsentInvoices" | "sentInvoices" | "activeDeliveries" | "deliveredToday" | "totalCustomers" | "activeUsers";
  const cards: { key: CardKey; label: string; icon: LucideIcon }[] = [
    { key: "newOrders", label: "طلبات جديدة", icon: ClipboardList },
    { key: "archivedOrders", label: "طلبات مؤرشفة", icon: Archive },
    { key: "invoicedOrders", label: "طلبات مفوترة", icon: Receipt },
    { key: "unsentInvoices", label: "فواتير غير مرسلة", icon: Send },
    { key: "sentInvoices", label: "فواتير مرسلة", icon: CheckCircle2 },
    { key: "activeDeliveries", label: "توصيلات نشطة", icon: Truck },
    { key: "deliveredToday", label: "تم التسليم اليوم", icon: PackageCheck },
    { key: "totalCustomers", label: "إجمالي العملاء", icon: Users },
    { key: "activeUsers", label: "المستخدمون النشطون", icon: UserCog },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            size="sm"
            variant={range === r.key ? "default" : "outline"}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const value = data?.[c.key];
          return (
            <div
              key={c.key}
              className="rounded-2xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-xs text-muted-foreground sm:text-sm">{c.label}</div>
              <div className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {isLoading ? "…" : (value ?? 0)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
