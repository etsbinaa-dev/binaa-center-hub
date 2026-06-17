import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "الطلبات — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="orders" title="الطلبات">
      <ModulePlaceholder
        title="إدارة الطلبات"
        description="ستظهر هنا قائمة الطلبات وحالاتها وأدوات الإنشاء والتعديل. سيتم بناء التفاصيل في الخطوات القادمة."
        icon={<ClipboardList className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
