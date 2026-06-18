import { createFileRoute } from "@tanstack/react-router";
import { runFollowupScan } from "@/lib/accounts-followup.functions";

export const Route = createFileRoute("/api/public/hooks/accounts-followup-scan")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await runFollowupScan(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[accounts-followup-scan] failed", e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
