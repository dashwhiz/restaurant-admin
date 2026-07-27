'use client';

import { useMemo, useRef, useState } from 'react';
import { normName } from '@/lib/pos/match';
import type { Recipe } from '@/lib/types';

export const SKIP = '__skip__';

// Long lists are the whole problem here — a POS day can need dozens of manual
// matches against hundreds of recipes. Cap what's drawn; typing narrows it.
const MAX_SHOWN = 50;

interface Option {
  id: string;
  name: string;
}

/**
 * Type-to-filter recipe picker. A native <select> means scrolling hundreds of
 * options to find one; here you type a few letters instead.
 *
 * Values are recipe ids, never names — two recipes may share a name, and a
 * name-keyed control would silently pick the wrong one.
 */
export function RecipePicker({
  value,
  recipes,
  onChange,
  invalid,
}: {
  value: string; // recipe id | SKIP | ''
  recipes: Recipe[];
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabel =
    value === SKIP ? 'Прескокни' : (recipes.find((r) => r.id === value)?.name ?? '');

  const options = useMemo<Option[]>(() => {
    const q = normName(query.trim());
    const matches = q
      ? recipes.filter((r) => normName(r.name).includes(q))
      : recipes;
    const list: Option[] = matches.slice(0, MAX_SHOWN).map((r) => ({ id: r.id, name: r.name }));
    // Skip stays reachable no matter what's typed — it's how you dismiss a line.
    return [{ id: SKIP, name: 'Прескокни' }, ...list];
  }, [recipes, query]);

  function choose(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setHighlight((h) => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
        return (next + options.length) % options.length;
      });
    } else if (e.key === 'Enter') {
      if (open && options[highlight]) {
        e.preventDefault();
        choose(options[highlight].id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="relative">
      <input
        className={`input py-1 ${invalid ? 'border-danger' : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="— избери —"
        value={open ? query : selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setHighlight(0);
          setOpen(true);
        }}
        // A click on an option fires blur first, so close on a short delay and
        // let the option's mousedown win.
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <ul
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 text-sm"
          role="listbox"
        >
          {options.length === 1 && query.trim() !== '' && (
            <li className="px-3 py-1.5 text-muted">Нема резултати</li>
          )}
          {options.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`block w-full px-3 py-1.5 text-left ${
                  i === highlight ? 'bg-primary/15 text-primary' : ''
                } ${o.id === SKIP ? 'text-muted' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  // mousedown, not click: blur would close the list first.
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  choose(o.id);
                }}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
