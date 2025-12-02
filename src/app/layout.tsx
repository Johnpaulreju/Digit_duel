import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Digit Duel',
  description: 'Two-player 4-digit guessing game built with Next.js & Tailwind',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
