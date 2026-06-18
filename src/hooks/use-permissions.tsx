import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULE_ACCESS, type ModuleKey, type Role } from "@/lib/roles";

export type Permission = "view" | "create" | "edit" | "delete";

export type PermissionMatrix = Record<Role, Record<ModuleKey, Record<Permission, boolean>>>;

const MODULES: ModuleKey[] = [
  "home",
  "orders",
  "invoices",
  "delivery",
  "inventory",
  "customers",
  "users",
  "reports",
  "accounts_followup",
  "daily_payments",
  "settings",
];

const ROLES_LIST: Role[] = ["admin", "accountant", "delivery", "monitor"];
const PERMS: Permission[] = ["view", "create", "edit", "delete"];

function defaultMatrix(): PermissionMatrix {
  const m = {} as PermissionMatrix;
  for (const r of ROLES_LIST) {
    m[r] = {} as Record<ModuleKey, Record<Permission, boolean>>;
    for (const mod of MODULES) {
      const canView = MODULE_ACCESS[mod]?.includes(r) ?? false;
      m[r][mod] = {
        view: canView,
        create: canView && r !== "monitor",
        edit: canView && r !== "monitor",
        delete: canView && r === "admin",
      };
    }
  }
  return m;
}

type Ctx = {
  matrix: PermissionMatrix;
  loaded: boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = createContext<Ctx>({
  matrix: defaultMatrix(),
  loaded: false,
  refresh: async () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(defaultMatrix());
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    const { data, error } = await (supabase as any)
      .from("role_permissions")
      .select("role, module, permission, allowed");
    if (error || !data) {
      setLoaded(true);
      return;
    }
    const next = defaultMatrix();
    for (const row of data as Array<{ role: Role; module: string; permission: Permission; allowed: boolean }>) {
      const mod = row.module as ModuleKey;
      if (next[row.role]?.[mod]) {
        next[row.role][mod][row.permission] = row.allowed;
      }
    }
    setMatrix(next);
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <PermissionsContext.Provider value={{ matrix, loaded, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function hasPermission(
  matrix: PermissionMatrix,
  role: Role,
  module: ModuleKey,
  permission: Permission,
): boolean {
  return matrix[role]?.[module]?.[permission] ?? false;
}

export { MODULES, ROLES_LIST, PERMS };
