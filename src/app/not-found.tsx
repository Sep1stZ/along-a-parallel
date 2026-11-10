import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-page">
      <p className="eyebrow">BEYOND THE MAP</p>
      <h1>这一页还没有故事</h1>
      <p>链接可能已失效。沿着熟悉的纬线，重新出发。</p>
      <Link className="primary" href="/">
        回到北纬 30° →
      </Link>
    </main>
  );
}
