import type { ReactNode } from "react";

export function ModulePlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}
