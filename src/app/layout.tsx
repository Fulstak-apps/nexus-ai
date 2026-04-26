import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ShortcutsOverlay } from '@/components/ui/ShortcutsOverlay';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

export const metadata: Metadata = {
  title: 'Nexus AI',
  description: 'Autonomous AI agent — plan, research, code, and execute',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply persisted theme before paint to avoid flash. Default = light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('nexus-ai-state-v2');if(s){var t=JSON.parse(s).state&&JSON.parse(s).state.theme;if(t==='dark'){document.documentElement.classList.add('dark');return;}if(t==='system'){var m=window.matchMedia('(prefers-color-scheme: dark)').matches;if(m)document.documentElement.classList.add('dark');return;}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-screen overflow-hidden antialiased">
        <ErrorBoundary>
          <ThemeProvider>
            <SessionProvider>{children}</SessionProvider>
            <ToastContainer />
            <ShortcutsOverlay />
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
