/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore, type Snapshot } from '@/lib/server/store';
import { isApiError } from '@/lib/server/errors';
import { coordinate, latitudeLabel } from '@/lib/geo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function SharedJourney({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  let snapshot: Snapshot;
  try {
    snapshot = getStore().getSnapshot(token);
  } catch (error) {
    if (isApiError(error) && error.status === 410)
      return (
        <main className="shared-main">
          <p className="eyebrow">JOURNEY WITHDRAWN</p>
          <h1>这条分享旅程已撤销</h1>
          <p>原作者已关闭此公开快照。你仍可以开始自己的探索。</p>
          <Link className="primary" href="/">
            开始自己的探索 →
          </Link>
        </main>
      );
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
  const byId = new Map(snapshot.places.map((place) => [place.id, place]));
  const cities = ordered.map((id) => byId.get(id)).filter((p) => p !== undefined);
  const requestedPage = Number((await searchParams).page ?? 1);
  const pages = Math.max(1, Math.ceil(cities.length / 12));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.max(1, Math.min(pages, requestedPage))
    : 1;
  const visibleCities = cities.slice((page - 1) * 12, page * 12);
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
          座快照城市
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
          {snapshot.truncated
            ? ' 本次快照保留最多 60 座城市，优先展示选中、比较、收藏与最近探索的地点。'
            : ''}
        </p>
        <p className="shared-legend">
          快照中已探索 {snapshot.explored.length} 座 · 收藏 {snapshot.favorites.length} 座
          {snapshot.compare.length === 2
            ? ` · 比较 ${snapshot.compare.map((id) => byId.get(id)?.name).join('与')}`
            : ''}
        </p>
        <div className="shared-grid">
          {visibleCities.map((p) => (
            <article className="shared-card" key={p.id}>
              {p.image && (
                <div className="city-art">
                  <img
                    src={p.image}
                    alt={`${p.name}地理档案示意插画`}
                    width="800"
                    height="600"
                    loading="lazy"
                  />
                  <span className="art-caption">地景插画 · 示意</span>
                </div>
              )}
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
              {!p.stories.length && <p className="muted">基础地理档案 · 尚未编写专题故事</p>}
              {(p.stories.length > 0 || p.sources.length > 0) && (
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
              )}
            </article>
          ))}
        </div>
        {pages > 1 && (
          <nav className="shared-meta" aria-label="分享城市分页">
            {page > 1 && <Link href={`/shared/${token}?page=${page - 1}`}>← 上一页</Link>}
            <span>
              第 {page} / {pages} 页 · 每页最多 12 座城市
            </span>
            {page < pages && <Link href={`/shared/${token}?page=${page + 1}`}>下一页 →</Link>}
          </nav>
        )}
        <Link className="primary" href="/">
          开始自己的探索 →
        </Link>
      </main>
    </>
  );
}
