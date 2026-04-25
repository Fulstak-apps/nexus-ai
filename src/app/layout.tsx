import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';

export const metadata: Metadata = {
  title: 'Nexus AI',
  description: 'Autonomous AI agent — plan, research, code, and execute',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen overflow-hidden antialiased bg-[#272728] text-[#dadada]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
