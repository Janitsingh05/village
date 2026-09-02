import type { Metadata, Viewport } from 'next';
import './globals.css';
import { VILLAGE, SITE_URL } from '@/lib/config';
import { LanguageProvider } from '@/lib/i18n';
import { VillageProvider } from '@/lib/village-context';
import ServiceWorker from '@/components/ServiceWorker';
import ConfigGate from '@/components/ConfigGate';
import OnboardingGate from '@/components/OnboardingGate';

export const metadata: Metadata = {
  title: 'GaonConnect · ' + VILLAGE.nameHi,
  description: 'गाँव की समस्या दर्ज करें और समाधान की स्थिति देखें। · Report and track village civic issues.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'GaonConnect', statusBarStyle: 'default' },
  // This app spreads by someone pasting the link into a village WhatsApp group.
  // Without these the paste is a bare URL, which reads as spam next to every
  // other link in the thread — so the share card is a distribution feature, not
  // an SEO nicety.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    siteName: 'GaonConnect',
    locale: 'hi_IN',
    title: 'GaonConnect · ' + VILLAGE.nameHi,
    description: 'गाँव की समस्या फ़ोटो के साथ दर्ज करें — सीधे पंचायत तक। स्थिति यहीं दिखेगी.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'GaonConnect' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GaonConnect · ' + VILLAGE.nameHi,
    description: 'गाँव की समस्या फ़ोटो के साथ दर्ज करें — सीधे पंचायत तक।',
    images: ['/og.png'],
  },
  alternates: { canonical: '/' },
  // Generated from assets/brand/logo.png by `npm run logo`. The tab favicon is
  // the cropped artwork, not the full badge — the wordmark is illegible at
  // 16px and only muddies the mark.
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#15803d',
  width: 'device-width',
  initialScale: 1,
  // No maximumScale. It was 5, which is generous and still a cap — and a cap on
  // pinch-zoom is a WCAG 1.4.4 failure with no upside, on an app whose users
  // include people who need to zoom to read at all.
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
            <OnboardingGate>
              <VillageProvider>{children}</VillageProvider>
            </OnboardingGate>
          </ConfigGate>
          <ServiceWorker />
        </LanguageProvider>
      </body>
    </html>
  );
}
