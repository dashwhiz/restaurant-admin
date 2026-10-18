import type { ReactNode } from 'react';

/** Yellow box above the import button for things that would be silently lost. */
export function ImportWarning({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="font-semibold">⚠ {title}</p>
      <div className="mt-1 text-muted">{children}</div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
