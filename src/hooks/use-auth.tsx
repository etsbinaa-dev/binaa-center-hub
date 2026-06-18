import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeRole, type Role } from "@/lib/roles";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Normalized app role (admin | accountant | delivery | monitor). null while loading. */
  role: Role | null;
  isAdmin: boolean;
  /** Refetch the role from the DB (useful right after an admin updates it). */
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  const fetchRole = async (uid: string): Promise<Role> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();
    return normalizeRole((data?.role as string | null) ?? null);
  };

  useEffect(() => {
    if (!session?.user) { setRole(null); return; }
    let cancelled = false;
    fetchRole(session.user.id).then((r) => { if (!cancelled) setRole(r); });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const refreshRole = async () => {
    if (!session?.user) return;
    setRole(await fetchRole(session.user.id));
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      role,
      isAdmin: role === "admin",
      refreshRole,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
