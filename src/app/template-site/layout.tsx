import type { Metadata } from 'next';
import { GeistSans } from 'geist/font';
import { GeistMono } from 'geist/font';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Beach House Retreat | Direct Booking',
  description: 'Book your stay at Beach House Retreat directly with the owner',
  openGraph: {
    title: 'Beach House Retreat | Direct Booking',
    description: 'Book your stay at Beach House Retreat directly with the owner',
    images: ['https://images.unsplash.com/photo-1499793983690-e29da59ef1c2'],
  },
};

export default function TemplateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} bg-gray-50`}>
        {children}
      </body>
    </html>
  );
} 