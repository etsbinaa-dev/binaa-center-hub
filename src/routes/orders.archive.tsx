import { createFileRoute } from "@tanstack/react-router";
import { Route as OrdersRoute } from "./orders";

// Reuse the same component as /orders — it switches between active/archived
// based on the current pathname.
export const Route = createFileRoute("/orders/archive")({
  head: () => ({ meta: [{ title: "أرشيف الطلبات — بِناء HUB" }] }),
  component: OrdersRoute.options.component!,
});
