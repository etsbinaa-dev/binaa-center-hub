import { createFileRoute } from "@tanstack/react-router";
import { DriverWages } from "@/components/driver-wages";

export const Route = createFileRoute("/driver-wages")({
  component: DriverWages,
});
