import { PageHeader } from './PageHeader';

/** Placeholder for a feature that hasn't been ported from the old app yet. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card text-sm text-muted">
        🚧 Оваа секција допрва се пренесува од старата апликација.
      </div>
    </>
  );
}
