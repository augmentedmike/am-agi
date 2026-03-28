import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { IntlWrapper } from '@/components/IntlWrapper';

export const metadata: Metadata = {
  title: 'HelloAm!',
  description: 'Kanban board for AM agent system',
  openGraph: {
    title: 'HelloAm!',
    description: 'Kanban board for AM agent system',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HelloAm!',
    description: 'Kanban board for AM agent system',
    images: ['/api/og'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-text-primary antialiased h-full overflow-hidden">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <LocaleProvider>
            <IntlWrapper>
              <ProjectsProvider>{children}</ProjectsProvider>
            </IntlWrapper>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
