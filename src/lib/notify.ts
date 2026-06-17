import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "created"
  | "updated"
  | "archived"
  | "invoice_new"
  | "invoice_sent"
  | "delivery_start"
  | "delivery_done"
  | "low_stock";

export async function notify(
  type: NotificationType,
  message: string,
  orderId?: string | null,
) {
  try {
    const { error } = await supabase.rpc("create_notification", {
      p_type: type,
      p_message: message,
      p_order_id: orderId ?? null,
    });
    if (error) console.error("[notify]", error);
  } catch (e) {
    console.error("[notify]", e);
  }
}
