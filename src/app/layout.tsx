import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
  title: 'ГеоКвест — путешествие по флагам и странам мира',
  description:
    'Интерактивный глобус, флаги всех 194 стран и игровые режимы с интервальным повторением.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
