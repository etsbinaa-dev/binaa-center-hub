import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Archive } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { OrdersList } from "@/components/orders-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/archive")({
  head: () => ({ meta: [{ title: "أرشيف الطلبات — بِناء HUB" }] }),
  component: OrdersArchivePage,
});

function OrdersArchivePage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isArchive = pathname.startsWith("/orders/archive");
  const base =
    "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition";

  return (
    <AppShell moduleKey="orders" title="الطلبات">
      <RequireAuth>
        <div className="space-y-5">
          <div className="flex gap-2">
            <Link
              to="/orders"
              className={cn(
                base,
                !isArchive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              الطلبات النشطة
            </Link>
            <Link
              to="/orders/archive"
              className={cn(
                base,
                isArchive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              <Archive className="h-4 w-4" />
              الأرشيف
            </Link>
          </div>
          <OrdersList status="archived" />
        </div>
      </RequireAuth>
    </AppShell>
  );
}
