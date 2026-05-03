import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { IntlWrapper } from '@/components/IntlWrapper';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

const BOARD_URL = 'https://board.helloam.bot';

export const metadata: Metadata = {
  metadataBase: new URL(BOARD_URL),
  title: 'AM Board',
  description: 'Gated agent runtime for engineering teams — kanban prefrontal cortex with server-side gate verification.',
  keywords: ['kanban', 'gated state machine', 'agent runtime', 'AI engineering', 'AM', 'helloam'],
  alternates: { canonical: BOARD_URL },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
    ],
  },
  openGraph: {
    title: 'AM Board',
    description: 'Gated agent runtime for engineering teams — kanban prefrontal cortex with server-side gate verification.',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AM Board',
    description: 'Gated agent runtime for engineering teams — kanban prefrontal cortex with server-side gate verification.',
    images: ['/api/og'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AM Board',
  description: 'Gated agent runtime for engineering teams — kanban prefrontal cortex with server-side gate verification.',
  url: BOARD_URL,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-text-primary antialiased min-h-screen overflow-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <LocaleProvider>
            <IntlWrapper>
              <OnboardingProvider>
                <ProjectsProvider>{children}</ProjectsProvider>
              </OnboardingProvider>
            </IntlWrapper>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
