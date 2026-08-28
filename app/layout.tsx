import type { Metadata, Viewport } from 'next';
import './globals.css';
import { VILLAGE } from '@/lib/config';
import { LanguageProvider } from '@/lib/i18n';
import { VillageProvider } from '@/lib/village-context';
import ServiceWorker from '@/components/ServiceWorker';
import ConfigGate from '@/components/ConfigGate';

export const metadata: Metadata = {
  title: 'GaonConnect · ' + VILLAGE.nameHi,
  description: 'गाँव की समस्या दर्ज करें और समाधान की स्थिति देखें। · Report and track village civic issues.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'GaonConnect', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#15803d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// No webfont on purpose: Android and iOS both ship a Devanagari face, and a
// ~100 KB font download is exactly the kind of thing that stalls on 3G.
// lang starts at "hi" and LanguageProvider updates it once the stored
// preference is read, so server and client markup always agree on first paint.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body className="font-sans">
        <LanguageProvider>
          <ConfigGate>
            <VillageProvider>{children}</VillageProvider>
          </ConfigGate>
          <ServiceWorker />
        </LanguageProvider>
      </body>
    </html>
  );
}
