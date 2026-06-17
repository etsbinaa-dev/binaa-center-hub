import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <LogIn className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold">يتطلب تسجيل الدخول</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          سجّل الدخول للوصول إلى وحدة الطلبات والعملاء.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          <LogIn className="h-4 w-4" />
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
