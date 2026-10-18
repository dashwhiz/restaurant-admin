'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { createEventsFromPos, type PosSpecial } from '@/lib/services/events';

/**
 * "N special orders found → move to Настани". Shared by the single-day and
 * bulk POS imports. The button locks while saving and after success; the
 * service also skips events that already exist, so nothing is created twice.
 */
export function SpecialOrders({ specials }: { specials: PosSpecial[] }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  if (specials.length === 0) return null;

  async function moveToEvents() {
    setState('busy');
    try {
      const { created, existing } = await createEventsFromPos(specials);
      const parts = [
        created ? `Создадени ${created} настани. Дополни го менито во Настани.` : '',
        existing ? `${existing} веќе постојат, прескокнати.` : '',
      ].filter(Boolean);
      toast(parts.join(' '), 'success');
      setState('done');
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
      setState('idle');
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-sm">
      <span>
        {specials.length} специјална нарачка пронајдена. Самата ставка е на „Прескокни“ — залихата
        се одзема кога ќе го завршиш настанот.
      </span>
      <button className="btn-ghost" onClick={moveToEvents} disabled={state !== 'idle'}>
        {state === 'busy' ? 'Се префрла…' : state === 'done' ? 'Префрлено ✓' : 'Префрли во Настани'}
      </button>
    </div>
  );
}
