import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ระบบออกหนังสือรับรองการหักภาษี ณ ที่จ่าย',
  description: 'ระบบจัดทำและตรวจสอบหนังสือรับรองการหักภาษี ณ ที่จ่าย'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
