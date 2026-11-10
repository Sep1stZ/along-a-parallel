/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore, type Snapshot } from '@/lib/server/store';
import { coordinate, latitudeLabel } from '@/lib/geo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function SharedJourney({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  let snapshot: Snapshot;
  try {
    snapshot = getStore().getSnapshot(token);
  } catch {
    notFound();
  }
  const ordered = [
    ...new Set([
      ...snapshot.cityIds,
      ...snapshot.favorites,
      ...snapshot.explored,
      ...snapshot.compare,
    ]),
  ];
  const cities = ordered
    .map((id) => snapshot.places.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/">
          <img src="/icon.svg" width="34" height="34" alt="" />
          <span>
            沿着一条纬线<small>ALONG A PARALLEL</small>
          </span>
        </Link>
        <span className="header-note">一份公开的、只读的旅程图册</span>
      </header>
      <main className="shared-main">
        <p className="eyebrow">A JOURNEY, PRESERVED</p>
        <h1>{snapshot.name}</h1>
        <p className="muted">
          {latitudeLabel(snapshot.latitude)}附近 · ±{snapshot.band}° · {snapshot.cityIds.length}{' '}
          座沿线城市
        </p>
        <div className="shared-meta">
          <span>
            创建于{' '}
            {new Intl.DateTimeFormat('zh-CN', {
              timeZone: 'Asia/Shanghai',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(snapshot.createdAt))}
            （北京时间）
          </span>
        </div>
        <p className="shared-note">
          这是一份创建时的只读快照。原作者之后的探索与收藏不会改变这里；此页面不包含私人旅程的修改权限。
        </p>
        <p className="shared-legend">
          已探索 {snapshot.explored.length} 座 · 收藏 {snapshot.favorites.length} 座
          {snapshot.compare.length === 2
            ? ` · 比较 ${snapshot.compare.map((id) => snapshot.places.find((p) => p.id === id)?.name).join('与')}`
            : ''}
        </p>
        <div className="shared-grid">
          {cities.map((p) => (
            <article className="shared-card" key={p.id}>
              <div className="city-art">
                <img
                  src={p.image}
                  alt={`${p.name}原创地景示意插画`}
                  width="800"
                  height="600"
                  loading="lazy"
                />
                <span className="art-caption">原创地景插画 · 示意</span>
              </div>
              <h2>
                {p.name} <span className="muted">{p.originalName}</span>
              </h2>
              <p>
                {p.country} · {coordinate(p.latitude)} / {coordinate(p.longitude, false)}
              </p>
              <p className="shared-legend">
                {snapshot.explored.includes(p.id) ? '✓ 已探索　' : ''}
                {snapshot.favorites.includes(p.id) ? '◇ 已收藏' : ''}
              </p>
              <p>{p.intro}</p>
              <details className="shared-stories">
                <summary>展开{p.name}的城市手记与来源</summary>
                {p.stories.map((story) => (
                  <section key={story.theme}>
                    <h3>{story.title}</h3>
                    <p>{story.body}</p>
                  </section>
                ))}
                <div className="sources">
                  <h3>资料来源</h3>
                  {p.sources.map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      <span>
                        {source.title}
                        <small>
                          {source.publisher} ·{' '}
                          {source.status === 'verified' ? '链接已核验' : '待进一步核验'} ·{' '}
                          {source.accessedAt}
                        </small>
                      </span>
                      ↗
                    </a>
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
        <Link className="primary" href="/">
          开始自己的探索 →
        </Link>
      </main>
    </>
  );
}
