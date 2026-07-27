import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Лира — Инвентар',
  description: 'Инвентар, продажби и трошоци за гостилница Лира',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mk" className="h-full antialiased">
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
