import { createContext, useContext } from "react";

export type Role = "admin" | "accountant" | "delivery";

export const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: "admin",
    label: "المدير",
    description: "صلاحيات كاملة على جميع الوحدات.",
  },
  {
    value: "accountant",
    label: "المحاسب",
    description:
      "رؤية الطلبات، إنشاء وتعديل الفواتير، إدارة العملاء، وأرشفة الطلبات والفواتير.",
  },
  {
    value: "delivery",
    label: "قسم التوصيلات",
    description:
      "رؤية الطلبات المفوترة الجاهزة للتوصيل وتحديث حالة التسليم — بدون رؤية الأسعار.",
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
  home: ["admin", "accountant", "delivery"],
  orders: ["admin", "accountant"],
  invoices: ["admin", "accountant"],
  delivery: ["admin", "delivery"],
  inventory: ["admin"],
  customers: ["admin", "accountant"],
  users: ["admin"],
  reports: ["admin"],
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
