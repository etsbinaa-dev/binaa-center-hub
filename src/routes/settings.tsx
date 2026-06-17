import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="settings" title="الإعدادات">
      <ModulePlaceholder
        title="إعدادات النظام"
        description="بيانات المؤسسة، التفضيلات العامة، التكاملات، والأمان."
        icon={<Settings className="h-6 w-6" />}
      />
    </AppShell>
  ),
});
