import { createContext, useContext } from "react";

export type Role = "admin" | "accountant" | "delivery" | "monitor";

export const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: "admin",
    label: "المدير",
    description: "صلاحيات كاملة على جميع الوحدات.",
  },
  {
    value: "accountant",
    label: "المحاسب",
    description: "الطلبات، الفواتير، العملاء، التقارير، الكميات.",
  },
  {
    value: "delivery",
    label: "مسؤول التوصيل",
    description: "قسم التوصيل فقط: الاتصال، الواتساب، تأكيد التسليم.",
  },
  {
    value: "monitor",
    label: "المراقب",
    description: "صفحة الكميات فقط.",
  },
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
  home: ["admin", "accountant", "delivery", "monitor"],
  orders: ["admin", "accountant"],
  invoices: ["admin", "accountant"],
  delivery: ["admin", "delivery"],
  inventory: ["admin", "accountant", "monitor"],
  customers: ["admin", "accountant"],
  users: ["admin"],
  reports: ["admin", "accountant"],
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
