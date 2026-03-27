import type { Metadata } from 'next';
import './globals.css';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { IntlWrapper } from '@/components/IntlWrapper';

export const metadata: Metadata = {
  title: 'AM Board',
  description: 'Kanban board for AM agent system',
  openGraph: {
    title: 'AM Board',
    description: 'Kanban board for AM agent system',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AM Board',
    description: 'Kanban board for AM agent system',
    images: ['/api/og'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-text-primary antialiased h-full overflow-hidden">
        <LocaleProvider>
          <IntlWrapper>
            <ProjectsProvider>{children}</ProjectsProvider>
          </IntlWrapper>
        </LocaleProvider>
      </body>
    </html>
  );
}
