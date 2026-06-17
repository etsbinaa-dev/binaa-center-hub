import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "المخزون — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="inventory" title="المخزون">
      <ModulePlaceholder
        title="إدارة المخزون"
        description="متابعة الأصناف، الكميات، المستودعات، وحركات الإدخال والإخراج."
        icon={<Package className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
