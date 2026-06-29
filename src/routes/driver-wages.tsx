import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { DriverWages } from "@/components/driver-wages";

export const Route = createFileRoute("/driver-wages")({
  head: () => ({ meta: [{ title: "مستحقات السائقين — بِناء HUB" }] }),
  component: () => (
    <AppShell moduleKey="driver_wages" title="مستحقات السائقين">
      <RequireAuth>
        <DriverWages />
      </RequireAuth>
    </AppShell>
  ),
});
