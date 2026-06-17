import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Truck, Archive } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { DeliveryList } from "@/components/delivery-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/delivery")({
  head: () => ({ meta: [{ title: "التوصيل — بِناء HUB" }] }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isArchive = pathname.startsWith("/delivery/archive");

  return (
    <AppShell moduleKey="delivery" title="التوصيل">
      <RequireAuth>
        <div className="space-y-5">
          <Tabs isArchive={isArchive} />
          {pathname === "/delivery" ? <DeliveryList view="active" /> : <Outlet />}
        </div>
      </RequireAuth>
    </AppShell>
  );
}

function Tabs({ isArchive }: { isArchive: boolean }) {
  const base = "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition";
  return (
    <div className="flex gap-2">
      <Link
        to="/delivery"
        className={cn(
          base,
          !isArchive
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Truck className="h-4 w-4" />
        طلبات التوصيل
      </Link>
      <Link
        to="/delivery/archive"
        className={cn(
          base,
          isArchive
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Archive className="h-4 w-4" />
        أرشيف التوصيل
      </Link>
    </div>
  );
}
