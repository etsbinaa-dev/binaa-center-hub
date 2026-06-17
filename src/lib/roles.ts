import { createContext, useContext } from "react";

export type Role =
  | "admin"
  | "accountant"
  | "delivery_staff"
  | "order_staff"
  | "supervisor";

export const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "مدير النظام" },
  { value: "accountant", label: "محاسب" },
  { value: "delivery_staff", label: "موظف توصيل" },
  { value: "order_staff", label: "موظف طلبات" },
  { value: "supervisor", label: "مشرف" },
];

export type ModuleKey =
  | "home"
  | "orders"
  | "invoices"
  | "delivery"
  | "inventory"
  | "customers"
  | "users"
  | "reports"
  | "settings";

export const MODULE_ACCESS: Record<ModuleKey, Role[]> = {
  home: ["admin", "accountant", "delivery_staff", "order_staff", "supervisor"],
  orders: ["admin", "order_staff", "supervisor"],
  invoices: ["admin", "accountant", "supervisor"],
  delivery: ["admin", "delivery_staff", "supervisor"],
  inventory: ["admin", "order_staff", "supervisor"],
  customers: ["admin", "accountant", "order_staff", "supervisor"],
  users: ["admin"],
  reports: ["admin", "accountant", "supervisor"],
  settings: ["admin"],
};

export function canAccess(role: Role, moduleKey: ModuleKey): boolean {
  return MODULE_ACCESS[moduleKey].includes(role);
}

export const RoleContext = createContext<{
  role: Role;
  setRole: (r: Role) => void;
}>({ role: "admin", setRole: () => {} });

export const useRole = () => useContext(RoleContext);
