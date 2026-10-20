'use client';

import { createEventsFromPos, type PosSpecial } from '@/lib/services/events';

/**
 * "N special orders found → they go to Настани on import". Shared by the
 * single-day and bulk POS imports. The import itself creates the events
 * (`importSpecials`): a separate button was easy to miss, and 19.10's orders
 * never reached Настани.
 */
export function SpecialOrders({ specials }: { specials: PosSpecial[] }) {
  if (specials.length === 0) return null;
  return (
    <div className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-sm">
      {specials.length} специјална нарачка пронајдена ({specials.map((s) => s.name).join(', ')}). При увоз
      автоматски се додава во Настани; залихата се одзема кога ќе го завршиш настанот.
    </div>
  );
}

/**
 * Create the events after the sales are saved. A failure here must not look
 * like a failed import (re-importing would sell the day twice), so it's
 * returned as a message instead of thrown.
 */
export async function importSpecials(specials: PosSpecial[]): Promise<string> {
  if (specials.length === 0) return '';
  try {
    const { created } = await createEventsFromPos(specials);
    return created ? ` Додадени ${created} настани во Настани — дополни им го менито.` : '';
  } catch (e) {
    return ` Настаните НЕ се додадени (${(e as Error).message}) — додај ги рачно во Настани.`;
  }
}
