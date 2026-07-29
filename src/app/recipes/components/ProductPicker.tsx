'use client';

import { useMemo, useRef, useState } from 'react';
import { normName } from '@/lib/pos/match';
import type { Product } from '@/lib/types';

// Long lists are the whole problem here — a product list can run to hundreds
// of entries. Cap what's drawn; typing narrows it.
const MAX_SHOWN = 50;

interface Option {
  id: string;
  name: string;
}

/**
 * Type-to-filter product picker for a recipe's ingredient row. A native
 * <select> means scrolling hundreds of options to find one; here you type a
 * few letters instead. Modeled on scan/components/ProductPicker.tsx and
 * imports/components/RecipePicker.tsx (same problem, different lists).
 */
export function ProductPicker({
  value,
  products,
  onChange,
}: {
  value: string; // product id, or '' when nothing chosen yet
  products: Product[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedLabel = products.find((p) => p.id === value)?.name ?? '';

  const options = useMemo<Option[]>(() => {
    const q = normName(query.trim());
    const matches = q ? products.filter((p) => normName(p.name).includes(q)) : products;
    return matches.slice(0, MAX_SHOWN).map((p) => ({ id: p.id, name: p.name }));
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
    <div className="relative flex-1">
      <input
        className="input w-full py-2"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Производ…"
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
          {options.length === 0 && (
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
                }`}
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
