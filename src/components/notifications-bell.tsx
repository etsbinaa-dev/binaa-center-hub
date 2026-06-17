import { useState } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  FilePlus2,
  Send,
  Truck,
  PackageCheck,
  AlertTriangle,
  Info,
  PackagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

type Severity = "success" | "info" | "action" | "warning";

function meta(type: Notification["type"]): { icon: typeof Bell; severity: Severity } {
  switch (type) {
    case "created":
      return { icon: PackagePlus, severity: "action" };
    case "invoice_new":
      return { icon: FilePlus2, severity: "info" };
    case "invoice_sent":
      return { icon: Send, severity: "success" };
    case "delivery_start":
      return { icon: Truck, severity: "action" };
    case "delivery_done":
      return { icon: PackageCheck, severity: "success" };
    case "low_stock":
      return { icon: AlertTriangle, severity: "warning" };
    case "archived":
      return { icon: Info, severity: "action" };
    default:
      return { icon: Info, severity: "info" };
  }
}

const sevStyles: Record<Severity, { wrap: string; icon: string }> = {
  success: { wrap: "bg-emerald-500/10 ring-emerald-500/20", icon: "text-emerald-600 dark:text-emerald-400" },
  info:    { wrap: "bg-sky-500/10 ring-sky-500/20",         icon: "text-sky-600 dark:text-sky-400" },
  action:  { wrap: "bg-orange-500/10 ring-orange-500/20",   icon: "text-orange-600 dark:text-orange-400" },
  warning: { wrap: "bg-red-500/10 ring-red-500/20",         icon: "text-red-600 dark:text-red-400" },
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, clearRead } = useNotifications();
  const hasRead = notifications.some((n) => n.read);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="الإشعارات" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -left-0.5 grid min-w-4 h-4 px-1 place-items-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" dir="rtl" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b space-y-2">
          <SheetTitle>الإشعارات</SheetTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4 ml-1" />
              تحديد الكل كمقروء
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasRead || clearRead.isPending}
              onClick={() => clearRead.mutate()}
            >
              <Trash2 className="h-4 w-4 ml-1" />
              مسح الإشعارات المقروءة
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">لا توجد إشعارات</p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const { icon: Icon, severity } = meta(n.type);
                const s = sevStyles[severity];
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                      !n.read && "bg-primary/5",
                    )}
                    onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1", s.wrap)}>
                        <Icon className={cn("h-4 w-4", s.icon)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm", !n.read && "font-medium")}>{n.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
