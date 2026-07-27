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
  IconSettings,
} from '@/components/ui/Icons';

export interface NavItem {
  href: string;
  label: string; // Macedonian, shown in the sidebar
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// The sidebar order. Add a feature here when its page exists.
export const NAV: NavItem[] = [
  { href: '/', label: 'Почетна', icon: IconDashboard },
  { href: '/products', label: 'Производи', icon: IconBox },
  { href: '/recipes', label: 'Рецепти', icon: IconBook },
  { href: '/deliveries', label: 'Испораки', icon: IconTruck },
  { href: '/sales', label: 'Продажби', icon: IconCash },
  { href: '/waste', label: 'Отпад', icon: IconTrash },
  { href: '/events', label: 'Настани', icon: IconEvent },
  { href: '/stocktake', label: 'Попис', icon: IconClipboard },
  { href: '/imports', label: 'Увоз', icon: IconImport },
  { href: '/prices', label: 'Цени', icon: IconTag },
  { href: '/kalo', label: 'Кало / Крш', icon: IconScale },
  { href: '/settings', label: 'Поставки', icon: IconSettings },
];
