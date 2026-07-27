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
  IconScan,
  IconTag,
  IconScale,
  IconSettings,
} from '@/components/ui/Icons';

export interface NavItem {
  href: string;
  label: string; // Macedonian, shown in the sidebar
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// The sidebar is split into labelled groups so the list stays scannable.
// A group with no title renders its items with no header (used for the top item).
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: '/', label: 'Почетна', icon: IconDashboard }],
  },
  {
    title: 'Залиха',
    items: [
      { href: '/products', label: 'Производи', icon: IconBox },
      { href: '/deliveries', label: 'Испораки', icon: IconTruck },
      { href: '/waste', label: 'Отпад', icon: IconTrash },
      { href: '/stocktake', label: 'Попис', icon: IconClipboard },
      { href: '/kalo', label: 'Кало / Крш', icon: IconScale },
    ],
  },
  {
    title: 'Продажба',
    items: [
      { href: '/recipes', label: 'Рецепти', icon: IconBook },
      { href: '/sales', label: 'Продажби', icon: IconCash },
      { href: '/prices', label: 'Цени', icon: IconTag },
      { href: '/events', label: 'Настани', icon: IconEvent },
    ],
  },
  {
    title: 'Внесување',
    items: [
      { href: '/imports', label: 'POS увоз', icon: IconImport },
      { href: '/scan', label: 'Скенирај фактура', icon: IconScan },
    ],
  },
  {
    title: 'Систем',
    items: [{ href: '/settings', label: 'Поставки', icon: IconSettings }],
  },
];
