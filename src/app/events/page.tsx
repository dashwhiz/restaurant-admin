'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconCheck } from '@/components/ui/Icons';
import { fmtMKD, fmtDate } from '@/lib/format';
import { listRecipes } from '@/lib/services/recipes';
import {
  listEvents,
  listEventMenus,
  completeEvent,
  deleteEvent,
  type MenuItemRow,
  type MenuDraft,
} from '@/lib/services/events';
import type { EventRow, Recipe } from '@/lib/types';
import { EventDialog } from './components/EventDialog';

export default function EventsPage() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [menus, setMenus] = useState<MenuItemRow[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; event: EventRow | null }>({ open: false, event: null });

  async function load() {
    setLoading(true);
    try {
      const [e, m, r] = await Promise.all([listEvents(), listEventMenus(), listRecipes()]);
      setEvents(e);
      setMenus(m);
      setRecipes(r);
    } catch (err) {
      toast('Грешка при вчитување: ' + (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuByEvent = useMemo(() => {
    const m = new Map<string, MenuItemRow[]>();
    for (const i of menus) {
      if (!m.has(i.event_id)) m.set(i.event_id, []);
      m.get(i.event_id)!.push(i);
    }
    return m;
  }, [menus]);

  const dialogMenu: MenuDraft[] = dialog.event
    ? (menuByEvent.get(dialog.event.id) ?? []).map((i) => ({ recipe_id: i.recipe_id, qty_per_person: i.qty_per_person }))
    : [];

  async function complete(ev: EventRow) {
    if (!confirm(`Означи "${ev.name}" како завршен и одземи ги состојките од залиха?`)) return;
    try {
      await completeEvent(ev, menuByEvent.get(ev.id) ?? []);
      toast('Настанот е завршен, залихата е ажурирана', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  async function remove(ev: EventRow) {
    const done = ev.status === 'done';
    if (!confirm(`Избриши "${ev.name}"?${done ? ' Состојките ќе се вратат во залиха.' : ''}`)) return;
    try {
      await deleteEvent(ev, menuByEvent.get(ev.id) ?? []);
      toast('Избришано', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Настани"
        subtitle="Кетеринг и специјални нарачки"
        actions={
          <button className="btn-primary" onClick={() => setDialog({ open: true, event: null })}>
            <IconPlus className="h-4 w-4" /> Нов настан
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted">Вчитување…</p>
      ) : events.length === 0 ? (
        <div className="card"><EmptyState text="Сè уште нема настани" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((ev) => {
            const menu = menuByEvent.get(ev.id) ?? [];
            return (
              <div key={ev.id} className="card">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{ev.name}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge tone={ev.status === 'done' ? 'green' : 'blue'}>{ev.status === 'done' ? 'Завршен' : 'Планиран'}</Badge>
                      <span>{ev.type}</span>
                      <span>· {fmtDate(ev.event_date)}</span>
                      <span>· {ev.guest_count} гости</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {ev.status !== 'done' && (
                      <button className="btn-ghost px-2 py-1 text-success" onClick={() => complete(ev)} aria-label="Заврши">
                        <IconCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button className="btn-ghost px-2 py-1" onClick={() => setDialog({ open: true, event: ev })} aria-label="Измени">
                      <IconEdit className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost px-2 py-1 text-danger" onClick={() => remove(ev)} aria-label="Избриши">
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {ev.price_per_person > 0 && (
                  <p className="text-sm text-muted">
                    {fmtMKD(ev.price_per_person)} × {ev.guest_count} = <strong className="text-foreground">{fmtMKD(ev.price_per_person * ev.guest_count)}</strong>
                  </p>
                )}
                {menu.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {menu.map((i) => (
                      <li key={i.id} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                        <span>{i.recipe?.name ?? '?'}</span>
                        <span className="text-muted">{i.qty_per_person}/гостин</span>
                      </li>
                    ))}
                  </ul>
                )}
                {ev.notes && <p className="mt-2 text-xs text-muted">{ev.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <EventDialog
        open={dialog.open}
        event={dialog.event}
        recipes={recipes}
        initialMenu={dialogMenu}
        onClose={() => setDialog({ open: false, event: null })}
        onSaved={load}
      />
    </>
  );
}
