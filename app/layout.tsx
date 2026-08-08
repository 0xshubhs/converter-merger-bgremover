import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Converter',
  description: 'Universal batch image converter for JPEG, PNG, JPG, HEIC, and more.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}