import { createFileRoute } from "@tanstack/react-router";
import { sendTelegram } from "@/lib/telegram-alert.functions";

export const Route = createFileRoute("/api/public/telegram-test")({
  server: {
    handlers: {
      GET: async () => {
        const result = await sendTelegram("✅ Binaa Hub Telegram integration is active.");
        return Response.json(result);
      },
    },
  },
});
