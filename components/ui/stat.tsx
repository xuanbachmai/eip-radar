import type { ReactNode } from "react";

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 border-l border-line pl-3">
      <div className="eyebrow truncate">{label}</div>
      <div className="num mt-1 text-2xl font-semibold leading-none sm:text-[28px]">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted">{note}</div> : null}
    </div>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  aside,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="mt-12 first:mt-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-2">
        <div>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h2 id={id ? `${id}-h` : undefined} className="display text-xl font-bold sm:text-2xl">
            {title}
          </h2>
        </div>
        {aside ? <div className="text-sm text-muted">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
      <h1 className="display text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
      {children ? <div className="mt-3 max-w-3xl text-muted">{children}</div> : null}
    </header>
  );
}
