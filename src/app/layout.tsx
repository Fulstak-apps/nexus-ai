import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ShortcutsOverlay } from '@/components/ui/ShortcutsOverlay';

export const metadata: Metadata = {
  title: 'Nexus AI',
  description: 'Autonomous AI agent — plan, research, code, and execute',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen overflow-hidden antialiased bg-[#272728] text-[#dadada]">
        <ErrorBoundary>
          <SessionProvider>{children}</SessionProvider>
          <ToastContainer />
          <ShortcutsOverlay />
        </ErrorBoundary>
      </body>
    </html>
  );
}
