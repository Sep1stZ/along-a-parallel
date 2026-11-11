import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '沿着一条纬线 · Along a Parallel',
  description:
    '同一条纬线，很多种生活。搜索全球三万多个真实地点，沿八条精选纬度带阅读六十座城市的手记，比较、收藏并分享自己的地理图册。',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/fonts/noto-sans-sc-latin-cjk.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
