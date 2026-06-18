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

// Maps Telegram alert kind -> notification_settings.kind row
const SETTINGS_KIND_MAP: Partial<Record<TelegramAlertKind, string>> = {
  order_new: "order_new",
  invoice_new: "invoice_new",
  invoice_sent: "invoice_sent",
  delivery_start: "delivery_start",
  delivery_done: "delivery_done",
};

export async function isNotificationEnabled(kind: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("notification_settings")
      .select("enabled")
      .eq("kind", kind)
      .maybeSingle();
    if (error) {
      console.error("[notify:settings]", error);
      return true; // fail-open
    }
    if (!data) return true;
    return data.enabled !== false;
  } catch (e) {
    console.error("[notify:settings]", e);
    return true;
  }
}

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
    const settingsKind = SETTINGS_KIND_MAP[tgKind];
    if (settingsKind) {
      const enabled = await isNotificationEnabled(settingsKind);
      if (!enabled) {
        console.info(`[notify] telegram skipped (disabled): ${settingsKind}`);
        return;
      }
    }
    sendTelegramAlert({ data: { kind: tgKind, message } }).catch((e) =>
      console.error("[notify:telegram]", e),
    );
  }
}
