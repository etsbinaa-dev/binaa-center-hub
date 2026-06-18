import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerServiceWorker } from "../lib/register-sw";
import { AuthProvider } from "@/hooks/use-auth";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const isFollowupRoute =
    typeof window !== "undefined" && window.location.pathname === "/accounts-followup";
  const errorMessage = error?.message ?? "Unknown error";

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  if (isFollowupRoute) {
    console.error("[followup] root route fallback caught crash", {
      message: errorMessage,
      error,
    });
    return (
      <div dir="rtl" className="min-h-screen bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <header className="border-b border-border pb-4">
            <h1 className="text-xl font-bold">متابعة الدفع</h1>
          </header>
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="text-base font-bold">لا توجد بيانات قابلة للعرض حالياً</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              تم منع انهيار الصفحة. حدث خطأ أثناء تحميل صفحة المتابعة، لذلك يتم عرض حالة فارغة بدلاً من شاشة بيضاء.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground" dir="ltr">
              {errorMessage}
            </pre>
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              إعادة المحاولة
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "بِناء HUB — منصة الأعمال المركزية" },
      { name: "description", content: "منصة BINA'A HUB المركزية لإدارة الطلبات والفواتير والتوصيل والمخزون والعملاء والمستخدمين والتقارير." },
      { property: "og:title", content: "بِناء HUB — منصة الأعمال المركزية" },
      { property: "og:description", content: "منصة BINA'A HUB المركزية لإدارة الطلبات والفواتير والتوصيل والمخزون والعملاء والمستخدمين والتقارير." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "بِناء HUB — منصة الأعمال المركزية" },
      { name: "twitter:description", content: "منصة BINA'A HUB المركزية لإدارة الطلبات والفواتير والتوصيل والمخزون والعملاء والمستخدمين والتقارير." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5e3f8d4b-280a-464d-91c5-95b34e97c6ff/id-preview-2e5e65ab--ed2dd7aa-6846-4f5d-bde3-de949aee2722.lovable.app-1781734912141.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5e3f8d4b-280a-464d-91c5-95b34e97c6ff/id-preview-2e5e65ab--ed2dd7aa-6846-4f5d-bde3-de949aee2722.lovable.app-1781734912141.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#059669" },
      { name: "application-name", content: "بِناء HUB" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "بِناء HUB" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <Outlet />
          <Toaster position="top-center" richColors />
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
