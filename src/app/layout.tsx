import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '沿着一条纬线 · Along a Parallel',
  description:
    '同一条纬线，很多种生活。转动地球，沿着三个纬度带探索十六座城市的自然、建筑、食物与日常。',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
