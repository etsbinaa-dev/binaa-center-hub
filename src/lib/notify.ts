import { supabase } from "@/integrations/supabase/client";
import { sendTelegramAlert, type TelegramAlertKind } from "@/lib/telegram-alert.functions";

export type NotificationType =
  | "created"
  | "updated"
  | "archived"
  | "invoice_new"
  | "invoice_sent"
  | "delivery_start"
  | "delivery_done"
  | "low_stock";

const TELEGRAM_MAP: Partial<Record<NotificationType, TelegramAlertKind>> = {
  created: "order_new",
  invoice_new: "invoice_new",
  invoice_sent: "invoice_sent",
  delivery_start: "delivery_start",
  delivery_done: "delivery_done",
  low_stock: "low_stock",
};

export async function notify(
  type: NotificationType,
  message: string,
  orderId?: string | null,
) {
  try {
    const { error } = await supabase.rpc("create_notification", {
      p_type: type,
      p_message: message,
      p_order_id: orderId ?? undefined,
    });
    if (error) console.error("[notify]", error);
  } catch (e) {
    console.error("[notify]", e);
  }

  const tgKind = TELEGRAM_MAP[type];
  if (tgKind) {
    sendTelegramAlert({ data: { kind: tgKind, message } }).catch((e) =>
      console.error("[notify:telegram]", e),
    );
  }
}
