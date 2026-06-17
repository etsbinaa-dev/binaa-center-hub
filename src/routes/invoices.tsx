import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/invoices")({
  head: () => ({ meta: [{ title: "الفواتير — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="invoices" title="الفواتير">
      <ModulePlaceholder
        title="إدارة الفواتير"
        description="إصدار الفواتير، تتبع المدفوعات، وربطها بالطلبات والعملاء."
        icon={<Receipt className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
