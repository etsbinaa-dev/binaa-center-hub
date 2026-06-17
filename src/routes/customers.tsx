import { createFileRoute } from "@tanstack/react-router";
import { User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "العملاء — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="customers" title="العملاء">
      <ModulePlaceholder
        title="إدارة العملاء"
        description="قاعدة بيانات العملاء، الحسابات، تاريخ الطلبات، والتواصل."
        icon={<User className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
