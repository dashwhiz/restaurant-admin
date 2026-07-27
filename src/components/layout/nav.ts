import type { ComponentType, SVGProps } from 'react';
import {
  IconDashboard,
  IconBox,
  IconBook,
  IconTruck,
  IconCash,
  IconTrash,
  IconEvent,
  IconClipboard,
  IconImport,
  IconTag,
  IconScale,
  IconChart,
  IconSettings,
} from '@/components/ui/Icons';

export interface NavItem {
  href: string;
  label: string; // Macedonian, shown in the sidebar
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// The sidebar is split into labelled groups so the list stays scannable.
// A group with no title renders its items with no header.
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

// Deliberately a FLAT list in the same order as the old HTML app. The owner
// works from muscle memory built there; regrouping the menu "more logically"
// costs him every single time he goes looking for a page.
//
// Three old entries are intentionally absent:
//   Извештаи      — merged into Аналитика (same data, one load)
//   Увоз шифрарник — merged into POS Увоз, which detects the file type itself
//   Преведи имиња  — not ported
// Скенирај фактура is reached from Испораки, exactly as it was before.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Контролна табла', icon: IconDashboard },
      { href: '/products', label: 'Производи', icon: IconBox },
      { href: '/recipes', label: 'Рецепти', icon: IconBook },
      { href: '/prices', label: 'Цени на рецепти', icon: IconTag },
      { href: '/kalo', label: 'Кало / Крш', icon: IconScale },
      { href: '/events', label: 'Настани', icon: IconEvent },
      { href: '/deliveries', label: 'Испораки', icon: IconTruck },
      { href: '/sales', label: 'Продажби', icon: IconCash },
      { href: '/waste', label: 'Отпад', icon: IconTrash },
      { href: '/imports', label: 'POS Увоз', icon: IconImport },
      { href: '/analytics', label: 'Аналитика', icon: IconChart },
      { href: '/orders', label: 'Листа за нарачка', icon: IconClipboard },
      { href: '/stocktake', label: 'Попис', icon: IconClipboard },
      { href: '/settings', label: 'Поставки', icon: IconSettings },
    ],
  },
];
