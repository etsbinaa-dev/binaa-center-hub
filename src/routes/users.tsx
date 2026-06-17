import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "المستخدمون — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="users" title="المستخدمون">
      <ModulePlaceholder
        title="إدارة المستخدمين"
        description="إضافة الموظفين، تعيين الأدوار، وضبط الصلاحيات داخل النظام."
        icon={<Users className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
