import { createFileRoute } from "@tanstack/react-router";
import { runDailyReport } from "@/lib/daily-report.functions";

export const Route = createFileRoute("/api/public/hooks/daily-report")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await runDailyReport(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[daily-report] failed", e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
