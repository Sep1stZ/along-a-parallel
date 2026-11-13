import { ArrowUpRight, BookOpen, Compass, MapPin } from 'lucide-react';
import type { Place, RelatedPlace } from '@/lib/place-types';
import { exploreUrl } from '@/lib/geo';

export default function PlaceDossier({
  place,
  onExplore,
}: {
  place: Place;
  onExplore?: (id: string) => void;
}) {
  const { profile, article } = place;
  if (!profile && !article) return null;
  const relatedLink = (point: RelatedPlace) => {
    const content = (
      <>
        <span>
          <strong>{point.name}</strong>
          <small>
            {point.country} · {point.direction ? `${point.direction} · ` : ''}约{' '}
            {point.distanceKm < 1 ? '<1' : Math.round(point.distanceKm).toLocaleString()} km
          </small>
        </span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </>
    );
    return onExplore ? (
      <button key={point.id} onClick={() => onExplore(point.id)}>
        {content}
      </button>
    ) : (
      <a
        key={point.id}
        href={exploreUrl({
          latitude: point.latitude,
          longitude: point.longitude,
          band: 2,
          selectedCity: point.id,
          compare: [],
        })}
      >
        {content}
      </a>
    );
  };
  return (
    <div className="place-dossier">
      {article && (
        <section className="place-article" aria-label="城市速读">
          <p className="eyebrow">
            <BookOpen size={15} aria-hidden="true" /> CITY READER · 城市速读
          </p>
          <h3>{article.title}</h3>
          {article.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <div className="article-credit">
            <a href={article.source.url} target="_blank" rel="noreferrer">
              {article.source.title} · {article.source.publisher} ↗
            </a>
            <span>
              读取于 {article.source.accessedAt} ·{' '}
              <a href={article.source.licenseUrl} target="_blank" rel="noreferrer">
                {article.source.license}
              </a>
              {article.source.revision && (
                <>
                  {' · '}
                  <a href={article.source.revision} target="_blank" rel="noreferrer">
                    查看原始修订
                  </a>
                </>
              )}
            </span>
            {article.source.scope && <small>{article.source.scope}</small>}
          </div>
        </section>
      )}
      {profile && (
        <>
          <section className="place-geography" aria-label="地理档案">
            <p className="eyebrow">
              <Compass size={15} aria-hidden="true" /> A PLACE IN THE WORLD · 地理档案
            </p>
            <h3>从这里，读懂周围的世界。</h3>
            <div className="profile-grid">
              <section>
                <h4>位置与区域</h4>
                <p>{profile.regionText}</p>
                <p>{profile.coordinateText}</p>
              </section>
              <section>
                <h4>所在的纬度</h4>
                <p>{profile.latitudeText}</p>
              </section>
              <section>
                <h4>这里的钟表</h4>
                <p>{profile.timezoneText}</p>
              </section>
              {profile.elevationText && (
                <section>
                  <h4>地面的高度</h4>
                  <p>{profile.elevationText}</p>
                </section>
              )}
            </div>
            {!!profile.aliases?.length && (
              <div className="place-aliases">
                <h4>也可以用这些名字找到这里</h4>
                <p>{profile.aliases.join(' · ')}</p>
              </div>
            )}
          </section>
          {!!profile.nearby.length && (
            <section className="place-connections" aria-label="附近地点">
              <h3>
                <MapPin size={18} aria-hidden="true" /> 附近还有哪些地方
              </h3>
              <p>按收录点位计算的球面直线距离，可帮助认识相对位置；不是道路里程。</p>
              <div className="related-places">{profile.nearby.map(relatedLink)}</div>
            </section>
          )}
          {!!profile.related.length && (
            <section className="place-connections" aria-label="继续阅读精选城市">
              <h3>
                <BookOpen size={18} aria-hidden="true" /> 继续读一座城市
              </h3>
              <p>从距离较近的精选手记出发，继续了解地理、建筑、生活与饮食。</p>
              <div className="related-places">{profile.related.map(relatedLink)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
