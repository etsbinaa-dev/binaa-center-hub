import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/delivery")({
  head: () => ({ meta: [{ title: "التوصيل — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="delivery" title="التوصيل">
      <ModulePlaceholder
        title="إدارة التوصيل"
        description="جدولة الشحنات، تعيين السائقين، ومتابعة حالة التسليم في الوقت الحقيقي."
        icon={<Truck className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
