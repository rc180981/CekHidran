import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Cek Hidran', template: '%s · Cek Hidran' },
  description: 'Pencatatan pemeriksaan Hydrant Box dan equipment',
  applicationName: 'Cek Hidran',
  appleWebApp: { capable: true, title: 'Cek Hidran', statusBarStyle: 'default' },
  icons: { icon: '/icons/192', apple: '/icons/180' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0E7C86',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-screen font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
