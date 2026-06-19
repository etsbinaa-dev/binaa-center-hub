import { createFileRoute } from "@tanstack/react-router";
import { InvoicesList } from "@/components/invoices-list";

export const Route = createFileRoute("/invoices/sent")({
  head: () => ({ meta: [{ title: "تم الإرسال — فرز وإرسال" }] }),
  component: () => <InvoicesList status="sent" />,
});
