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
    description: "الطلبات، الفواتير، العملاء، التقارير.",
  },
  {
    value: "delivery",
    label: "مسؤول التوصيل",
    description: "صفحات التوصيل وأرشيف التوصيل فقط.",
  },
  {
    value: "monitor",
    label: "المراقب",
    description: "صلاحية القراءة فقط لجميع الأقسام.",
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
  orders: ["admin", "accountant", "monitor"],
  invoices: ["admin", "accountant", "monitor"],
  delivery: ["admin", "delivery", "monitor"],
  inventory: ["admin", "accountant", "monitor"],
  customers: ["admin", "accountant", "monitor"],
  users: ["admin"],
  reports: ["admin", "accountant", "monitor"],
  settings: ["admin"],
};

export function canAccess(role: Role, moduleKey: ModuleKey): boolean {
  return MODULE_ACCESS[moduleKey].includes(role);
}

export function canWrite(role: Role): boolean {
  return role !== "monitor";
}

/** Normalize a raw role string from the DB (which may include legacy 'employee') into one of the 4 app roles. */
export function normalizeRole(raw: string | null | undefined): Role {
  if (raw === "admin" || raw === "accountant" || raw === "delivery" || raw === "monitor") return raw;
  // Legacy 'employee' and unknown roles default to the most restrictive role.
  return "monitor";
}

export const RoleContext = createContext<{
  role: Role;
  setRole: (r: Role) => void;
}>({ role: "monitor", setRole: () => {} });

export const useRole = () => useContext(RoleContext);
