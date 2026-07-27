// Theme choice. The app follows the OS by default; picking "светла" or "темна"
// in Поставки overrides that and is remembered in this browser.
//
// The choice is stored per browser, not in the database — it's a preference of
// whoever is sitting at this machine, and the whole restaurant shares one login.

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lira-theme';

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Светла',
  dark: 'Темна',
  system: 'Како системот',
};

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return isTheme(stored) ? stored : 'system';
}

/** Put the choice on <html>; "system" removes it so the CSS media query wins. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
