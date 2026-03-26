import type { Metadata } from 'next';
import './globals.css';
import { ProjectsProvider } from '@/contexts/ProjectsContext';

export const metadata: Metadata = {
  title: 'AM Board',
  description: 'Kanban board for AM agent system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased h-full overflow-hidden">
        <ProjectsProvider>{children}</ProjectsProvider>
      </body>
    </html>
  );
}
