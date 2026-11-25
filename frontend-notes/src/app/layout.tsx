import type { Metadata, Viewport } from 'next';
import { NotesShell } from '@/components/NotesShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Notater',
  description: 'Daglig arbeidslogg',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#2f5d8a',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body className="min-h-screen antialiased">
        <NotesShell>{children}</NotesShell>
      </body>
    </html>
  );
}
