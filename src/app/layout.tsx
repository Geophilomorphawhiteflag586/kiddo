import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
  title: 'Kiddo — Learn. Play. Grow.',
  description:
    'География, математика, английский, китайский, шахматы и анатомия в одном приложении. ' +
    'Короткие сессии и интервальное повторение: приложение само возвращает то, что забывается.',
  applicationName: 'Kiddo',
};

export const viewport: Viewport = {
  themeColor: '#eaeefb',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
