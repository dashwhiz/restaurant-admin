import type { ReactNode } from 'react';

type Tone = 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';

const tones: Record<Tone, string> = {
  gray: 'bg-muted/15 text-muted',
  green: 'bg-success/15 text-success',
  yellow: 'bg-yellow-200 text-yellow-700',
  red: 'bg-danger/15 text-danger',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
};

export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
