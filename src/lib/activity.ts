import { supabase } from "@/integrations/supabase/client";

export type ActivityModule =
  | "orders"
  | "invoices"
  | "delivery"
  | "customers"
  | "inventory"
  | "users"
  | "settings";

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "restore"
  | "import"
  | "mark_sent"
  | "start_delivery"
  | "delivered"
  | "save"
  | "enable"
  | "disable"
  | "reset_password";

let cachedActor: { name: string; role: string | null } | null = null;

async function resolveActor() {
  if (cachedActor) return cachedActor;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  cachedActor = {
    name: profile?.full_name || user.email?.split("@")[0] || "مستخدم",
    role: (roleRow?.role as string) ?? null,
  };
  return cachedActor;
}

export async function logActivity(params: {
  module: ActivityModule;
  action: ActivityAction;
  description: string;
}) {
  try {
    const actor = await resolveActor();
    if (!actor) return;
    await supabase.from("activity_logs").insert({
      user_name: actor.name,
      user_role: actor.role,
      module: params.module,
      action: params.action,
      description: params.description,
    });
  } catch {
    /* never let logging break the app */
  }
}

export const ACTIVITY_MODULE_LABELS: Record<ActivityModule, string> = {
  orders: "الطلبات",
  invoices: "الفواتير",
  delivery: "التوصيل",
  customers: "العملاء",
  inventory: "الكميات",
  users: "المستخدمون",
  settings: "الإعدادات",
};

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  archive: "أرشفة",
  restore: "استعادة",
  import: "استيراد",
  mark_sent: "وضع كمُرسلة",
  start_delivery: "بدء التوصيل",
  delivered: "تأكيد التسليم",
  save: "حفظ",
  enable: "تفعيل",
  disable: "تعطيل",
  reset_password: "إعادة تعيين كلمة المرور",
};
