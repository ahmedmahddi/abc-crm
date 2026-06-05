import * as React from "react";
import { cn } from "@/lib/cn";

export function PageStack({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-5", className)} {...props} />;
}

export function PageHeader({
  actions,
  eyebrow,
  title,
  description,
  className,
}: Readonly<{
  actions?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}>) {
  return (
    <header className={cn("rounded-lg border bg-white px-4 py-4 shadow-sm sm:px-5", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p> : null}
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PagePanel({
  as: Component = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" }) {
  return <Component className={cn("rounded-lg border bg-white p-4 shadow-sm sm:p-5", className)} {...props} />;
}

export function SectionHeader({
  actions,
  count,
  description,
  title,
  id,
}: Readonly<{
  actions?: React.ReactNode;
  count?: React.ReactNode;
  description?: string;
  title: string;
  id?: string;
}>) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" id={id}>{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {count ? <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground" aria-live="polite">{count}</p> : null}
        {actions}
      </div>
    </div>
  );
}

export function FilterBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-3 rounded-lg border bg-muted/45 p-3 md:grid-cols-[minmax(0,1fr)_14rem]", className)}
      {...props}
    />
  );
}

export function FilterField({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

export function RecordList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}
