import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Лира — Инвентар',
  description: 'Инвентар, продажби и трошоци за гостилница Лира',
};

// Runs before the first paint so a saved theme applies without the page briefly
// flashing the other one. It must be inline to beat the paint — a loaded file
// would arrive too late. Static string, no user input.
const applySavedTheme = `try{var t=localStorage.getItem('lira-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below deliberately sets data-theme on
    // <html> before React hydrates, so server and client markup differ here by
    // design. It applies to this element's own attributes only, not to children.
    <html lang="mk" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Script id="lira-theme" strategy="beforeInteractive">
          {applySavedTheme}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
