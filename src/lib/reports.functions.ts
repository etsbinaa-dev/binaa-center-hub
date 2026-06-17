import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function rangeStart(range: "today" | "week" | "month"): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === "today") return d;
  if (range === "week") {
    d.setDate(d.getDate() - 6);
    return d;
  }
  d.setDate(1);
  return d;
}

export const getReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { range: "today" | "week" | "month" }) =>
    z.object({ range: z.enum(["today", "week", "month"]) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const from = rangeStart(data.range).toISOString();
    const todayStart = rangeStart("today").toISOString();

    const count = (q: any) => q.then((r: any) => r.count ?? 0);

    const [
      newOrders,
      archivedOrders,
      invoicedOrders,
      unsentInvoices,
      sentInvoices,
      activeDeliveries,
      deliveredToday,
      totalCustomers,
      activeUsers,
    ] = await Promise.all([
      count(supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", from)),
      count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "archived").gte("created_at", from)),
      count(supabase.from("orders").select("id", { count: "exact", head: true }).not("invoiced_at", "is", null).gte("invoiced_at", from)),
      count(supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "new")),
      count(supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", from)),
      count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "archived").in("delivery_status", ["new", "in_progress"])),
      count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "delivered").gte("delivered_at", todayStart)),
      count(supabase.from("customers").select("id", { count: "exact", head: true })),
      count(supabase.from("profiles").select("id", { count: "exact", head: true })),
    ]);

    return {
      newOrders,
      archivedOrders,
      invoicedOrders,
      unsentInvoices,
      sentInvoices,
      activeDeliveries,
      deliveredToday,
      totalCustomers,
      activeUsers,
    };
  });
