import { createFileRoute } from "@tanstack/react-router";
import { DeliveryList } from "@/components/delivery-list";

export const Route = createFileRoute("/delivery/archive")({
  head: () => ({ meta: [{ title: "أرشيف التوصيل" }] }),
  component: () => <DeliveryList view="archive" />,
});
