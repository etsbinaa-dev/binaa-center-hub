import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Receipt, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { InvoicesList } from "@/components/invoices-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invoices")({
  head: () => ({ meta: [{ title: "فرز وإرسال — بِناء HUB" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSent = pathname.startsWith("/invoices/sent");

  return (
    <AppShell moduleKey="invoices" title="الفواتير">
      <RequireAuth>
        <div className="space-y-5">
          <Tabs isSent={isSent} />
          {pathname === "/invoices" ? <InvoicesList status="new" /> : <Outlet />}
        </div>
      </RequireAuth>
    </AppShell>
  );
}

function Tabs({ isSent }: { isSent: boolean }) {
  const base = "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition";
  return (
    <div className="flex gap-2">
      <Link
        to="/invoices"
        className={cn(
          base,
          !isSent
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Receipt className="h-4 w-4" />
        فواتير جديدة
      </Link>
      <Link
        to="/invoices/sent"
        className={cn(
          base,
          isSent
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Send className="h-4 w-4" />
        تم الإرسال
      </Link>
    </div>
  );
}
