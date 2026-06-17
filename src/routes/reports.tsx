import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "التقارير — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="reports" title="التقارير">
      <ModulePlaceholder
        title="التقارير والتحليلات"
        description="لوحات مؤشرات الأداء، تقارير المبيعات، المخزون، والتوصيل."
        icon={<BarChart3 className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
