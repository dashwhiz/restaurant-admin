'use client';

import { useMemo, useRef, useState } from 'react';
import { normName } from '@/lib/pos/match';
import { NEW_PRODUCT, SKIP } from '@/lib/services/scan';
import type { Product } from '@/lib/types';

// Long lists are the whole problem here — a supplier list can run to hundreds
// of products. Cap what's drawn; typing narrows it.
const MAX_SHOWN = 50;

interface Option {
  id: string;
  name: string;
}

/**
 * Type-to-filter product picker for a scan review row. A native <select> means
 * scrolling hundreds of options to find one; here you type a few letters
 * instead. Modeled on imports/components/RecipePicker.tsx (same problem, recipes
 * instead of products).
 */
export function ProductPicker({
  value,
  products,
  onChange,
}: {
  value: string; // product id | NEW_PRODUCT | SKIP
  products: Product[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabel =
    value === NEW_PRODUCT
      ? '+ Нов производ'
      : value === SKIP
        ? 'Прескокни'
        : (products.find((p) => p.id === value)?.name ?? '');

  const options = useMemo<Option[]>(() => {
    const q = normName(query.trim());
    const matches = q ? products.filter((p) => normName(p.name).includes(q)) : products;
    const list: Option[] = matches.slice(0, MAX_SHOWN).map((p) => ({ id: p.id, name: p.name }));
    // These two stay reachable no matter what's typed — they're how you create
    // or dismiss a line.
    return [{ id: NEW_PRODUCT, name: '+ Нов производ' }, { id: SKIP, name: 'Прескокни' }, ...list];
  }, [products, query]);

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
        className="input min-w-40 py-1"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Пребарај производ…"
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
          className="absolute z-20 mt-1 max-h-60 w-full min-w-40 overflow-y-auto rounded-lg border border-border bg-surface py-1 text-sm"
          role="listbox"
        >
          {options.length === 2 && query.trim() !== '' && (
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
                } ${o.id === SKIP || o.id === NEW_PRODUCT ? 'text-muted' : ''}`}
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
