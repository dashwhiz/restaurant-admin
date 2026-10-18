'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { shownCost, shownPrice } from '@/lib/vat';

const STORAGE_KEY = 'lira-vat';

interface VatState {
  /** true = show prices and costs with VAT. */
  withVat: boolean;
  setWithVat: (on: boolean) => void;
}

const VatContext = createContext<VatState>({ withVat: false, setWithVat: () => {} });

/** Remembers the "Без ДДВ / Со ДДВ" choice per browser. Starts without VAT. */
export function VatProvider({ children }: { children: ReactNode }) {
  const [withVat, setState] = useState(false);

  // Read after mount: localStorage doesn't exist during the static build.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === 'with') setState(true);
    } catch {
      // Storage blocked (private window etc.) — keep the default.
    }
  }, []);

  const setWithVat = useCallback((on: boolean) => {
    setState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'with' : 'without');
    } catch {
      // Not remembered, but the switch still works for this visit.
    }
  }, []);

  const value = useMemo(() => ({ withVat, setWithVat }), [withVat, setWithVat]);
  return <VatContext.Provider value={value}>{children}</VatContext.Provider>;
}

/**
 * The switch plus the two conversions every money cell needs:
 *  - cost(net, rate)   — for values stored WITHOUT VAT (product/purchase costs)
 *  - price(gross, rate) — for values stored WITH VAT (selling prices)
 * Each returns the version the switch asks for. The object only changes when
 * the switch does, so it can sit in a useMemo dependency list as `vat`.
 */
export function useVat() {
  const { withVat, setWithVat } = useContext(VatContext);
  return useMemo(
    () => ({
      withVat,
      setWithVat,
      label: withVat ? 'со ДДВ' : 'без ДДВ',
      cost: (net: number, rate: number) => shownCost(withVat, net, rate),
      price: (gross: number, rate: number) => shownPrice(withVat, gross, rate),
    }),
    [withVat, setWithVat],
  );
}

/** Two-way switch for the sidebar / mobile header. */
export function VatToggle({ className = '' }: { className?: string }) {
  const { withVat, setWithVat } = useVat();
  const option = (on: boolean, text: string) => (
    <button
      type="button"
      aria-pressed={withVat === on}
      onClick={() => setWithVat(on)}
      className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
        withVat === on ? 'bg-primary text-primary-fg' : 'text-muted hover:text-foreground'
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className={`flex gap-1 rounded-lg border border-border bg-background p-1 ${className}`} role="group" aria-label="ДДВ">
      {option(false, 'Без ДДВ')}
      {option(true, 'Со ДДВ')}
    </div>
  );
}
