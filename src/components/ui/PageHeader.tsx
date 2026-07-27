import type { ReactNode } from 'react';

/** Page title + subtitle on the left, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = '📋', text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
