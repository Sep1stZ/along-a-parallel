'use client';
/* Local artwork is intentionally rendered as ordinary SVG images: no image server or runtime network is needed. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Globe2,
  Heart,
  Layers2,
  LoaderCircle,
  MapPin,
  Share2,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { places as seedPlaces, type Place } from '@/data/places';
import { routes as seedRoutes } from '@/data/routes';
import {
  coordinate,
  exploreUrl,
  inBand,
  latitudeLabel,
  parseExplore,
  type ExploreState,
} from '@/lib/geo';
import Globe from './Globe';
import Dialog from './Dialog';

type Journey = ExploreState & { explored: string[] };
type Modal =
  | { type: 'story'; id: string }
  | { type: 'journey' }
  | { type: 'about' }
  | { type: 'compare' }
  | { type: 'replace'; id: string }
  | { type: 'share'; url: string };
const initial: Journey = {
  latitude: 30,
  band: 2,
  longitude: 120.1551,
  selectedCity: 'hangzhou',
  explored: [],
  compare: [],
};
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '请求失败，请稍后重试');
  return body;
}
function LocalTime({ place }: { place: Place }) {
  const [time, setTime] = useState('— : —');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat('zh-CN', {
          timeZone: place.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date()),
      );
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [place.timezone]);
  return <time suppressHydrationWarning>{time}</time>;
}
function Art({ place, priority = false }: { place: Place; priority?: boolean }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  return (
    <div className="city-art" style={{ background: place.accent || '#c0c3ab' }}>
      {failedId === place.id ? (
        <div className="art-fallback">
          <MapPin size={32} />
          <span>{place.name} · 城市插画暂未展开</span>
        </div>
      ) : (
        <img
          src={place.image}
          alt={`${place.name}的原创地景示意插画，并非实景照片`}
          width="800"
          height="600"
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setFailedId(place.id)}
        />
      )}
      <span className="art-caption">原创地景插画 · 示意</span>
    </div>
  );
}
function Sources({ place }: { place: Place }) {
  return (
    <div className="sources">
      <h3>故事从哪里来</h3>
      <p>以具体地点与案例观察城市。资料核验状态随每项来源列出，插画不替代实景记录。</p>
      {place.sources.map((source, i) => (
        <a key={i} href={source.url} target="_blank" rel="noreferrer">
          <span>
            {source.title}
            <small>
              {source.publisher} · {source.status === 'verified' ? '链接已核验' : '待进一步核验'} ·{' '}
              {source.accessedAt}
            </small>
            <small>{source.scope}</small>
          </span>
          <ExternalLink size={14} />
        </a>
      ))}
    </div>
  );
}
export default function Explorer() {
  const [journey, setJourney] = useState<Journey>(initial);
  const stateRef = useRef(journey);
  const [allPlaces, setAllPlaces] = useState<Place[]>(seedPlaces);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [saving, setSaving] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [compareResult, setCompareResult] = useState<{
    ids: string;
    similarities: string;
    differences: string;
  } | null>(null);
  const [compareErrorIds, setCompareErrorIds] = useState<string | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(false);
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 8500 : 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const persist = useCallback(
    (next: Journey) => {
      setSaving((n) => n + 1);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => api('/api/journey', { method: 'PATCH', body: JSON.stringify(next) }))
        .then(() => setSaveFailed(false))
        .catch(() => {
          setSaveFailed(true);
          notify('旅程未能保存。请保留页面，并点击“重试保存”。', true);
        })
        .finally(() => setSaving((n) => n - 1));
    },
    [notify],
  );
  const apply = useCallback(
    (next: Journey, history = true, save = true) => {
      stateRef.current = next;
      setJourney(next);
      if (history) window.history.pushState({}, '', exploreUrl(next));
      if (save) persist(next);
    },
    [persist],
  );
  const boot = useCallback(async () => {
    setBootError(false);
    try {
      const data = await api<{ journey: Journey }>('/api/journey');
      const [fav] = await Promise.all([
        api<{ favorites: string[] }>('/api/favorites'),
        api('/api/routes'),
      ]);
      setFavorites(fav.favorites);
      const parsed = parseExplore(
        window.location.search,
        seedPlaces.map((p) => p.id),
      );
      let next: Journey = { ...data.journey, ...(parsed || {}) };
      if (parsed?.selectedCity && !new URLSearchParams(window.location.search).has('lng'))
        next.longitude = seedPlaces.find((p) => p.id === parsed.selectedCity)!.longitude;
      if (window.location.search && !parsed) notify('链接参数无效，已恢复您上次的旅程。', true);
      const available = seedPlaces.filter((p) => inBand(p.latitude, next.latitude, next.band));
      if (!next.selectedCity && available.length) {
        const preferred =
          next.latitude === 30 ? 'hangzhou' : next.latitude === 45 ? 'venice' : 'rio';
        const first = available.find((p) => p.id === preferred) || available[0];
        next = { ...next, selectedCity: first.id, longitude: first.longitude };
      }
      if (next.selectedCity && !available.some((p) => p.id === next.selectedCity)) {
        const linked = seedPlaces.find((p) => p.id === next.selectedCity);
        if (linked && parsed) {
          next = { ...next, latitude: linked.latitude, longitude: linked.longitude };
        } else next = { ...next, selectedCity: available[0]?.id || null };
      }
      if (next.selectedCity) next.explored = [...new Set([...next.explored, next.selectedCity])];
      stateRef.current = next;
      setJourney(next);
      setReady(true);
      window.history.replaceState({}, '', exploreUrl(next));
      if (next.compare.length === 2 && parsed) setModal({ type: 'compare' });
      persist(next);
    } catch {
      setBootError(true);
      notify('暂时无法连接本地服务。重试后即可保存旅程。', true);
    }
  }, [notify, persist]);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void boot();
    }
  }, [boot]);
  useEffect(() => {
    const listener = () => {
      const parsed = parseExplore(
        window.location.search,
        seedPlaces.map((p) => p.id),
      );
      if (!parsed) {
        notify('链接参数无效，无法恢复该位置。', true);
        return;
      }
      apply({ ...stateRef.current, ...parsed }, false, ready);
      if (parsed.compare.length === 2) setModal({ type: 'compare' });
      else setModal(null);
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, [apply, notify, ready]);
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    api<{ places: Place[] }>(`/api/places?latitude=${journey.latitude}&band=${journey.band}`, {
      signal: abort.signal,
    })
      .then((data) =>
        setAllPlaces((current) => {
          const update = new Map(data.places.map((p) => [p.id, p]));
          return current.map((p) => update.get(p.id) || p);
        }),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') notify('城市数据暂未更新，仍可阅读本地内容。', true);
      });
    return () => abort.abort();
  }, [journey.latitude, journey.band, ready, notify]);
  const comparisonIds = journey.compare.join(',');
  useEffect(() => {
    if (modal?.type !== 'compare' || journey.compare.length !== 2) return;
    let active = true;
    api<{ similarities: string; differences: string }>(`/api/compare?ids=${comparisonIds}`)
      .then((data) => {
        if (active) {
          setCompareResult({ ...data, ids: comparisonIds });
          setCompareErrorIds(null);
        }
      })
      .catch(() => {
        if (active) setCompareErrorIds(comparisonIds);
      });
    return () => {
      active = false;
    };
  }, [modal?.type, comparisonIds, journey.compare.length]);
  const compareText = compareResult?.ids === comparisonIds ? compareResult : null;
  const compareError = compareErrorIds === comparisonIds;
  const currentPlaces = allPlaces
    .filter((p) => inBand(p.latitude, journey.latitude, journey.band))
    .sort((a, b) => a.longitude - b.longitude);
  const city = currentPlaces.find((p) => p.id === journey.selectedCity) || null;
  const exploredCount = currentPlaces.filter((p) => journey.explored.includes(p.id)).length;
  const select = (id: string) => {
    const p = allPlaces.find((p) => p.id === id);
    if (!p) return;
    const base = stateRef.current;
    apply(
      {
        ...base,
        selectedCity: id,
        longitude: p.longitude,
        latitude: inBand(p.latitude, base.latitude, base.band)
          ? base.latitude
          : (seedRoutes.find((route) => inBand(p.latitude, route.latitude, base.band))?.latitude ??
            p.latitude),
        explored: [...new Set([...base.explored, id])],
      },
      true,
      ready,
    );
  };
  const step = (direction: number) => {
    if (!currentPlaces.length) return;
    const index = currentPlaces.findIndex((p) => p.id === stateRef.current.selectedCity);
    select(currentPlaces[(index + direction + currentPlaces.length) % currentPlaces.length].id);
  };
  const setLatitude = (latitude: number) => {
    const matches = allPlaces
      .filter((p) => inBand(p.latitude, latitude, journey.band))
      .sort((a, b) => a.longitude - b.longitude);
    const next =
      matches.find(
        (p) =>
          p.id ===
          (latitude === 30
            ? 'hangzhou'
            : latitude === 45
              ? 'venice'
              : latitude === -23
                ? 'rio'
                : journey.selectedCity),
      ) || matches[0];
    apply(
      {
        ...journey,
        latitude,
        selectedCity: next?.id || null,
        longitude: next?.longitude || journey.longitude,
        explored: next ? [...new Set([...journey.explored, next.id])] : journey.explored,
      },
      true,
      ready,
    );
  };
  const toggleFavorite = async (id: string) => {
    if (!ready) {
      notify('请先等待旅程连接完成。', true);
      return;
    }
    const existed = favorites.includes(id);
    setFavoriteBusy((items) => [...items, id]);
    setFavorites((items) => (existed ? items.filter((x) => x !== id) : [...items, id]));
    try {
      await api(existed ? `/api/favorites/${id}` : '/api/favorites', {
        method: existed ? 'DELETE' : 'POST',
        ...(existed ? {} : { body: JSON.stringify({ placeId: id }) }),
      });
      notify(existed ? '已从收藏中移除' : '已收藏，留给下一次出发。');
    } catch {
      setFavorites((items) => (existed ? [...items, id] : items.filter((x) => x !== id)));
      notify('收藏未能保存，已恢复原状态。请重试。', true);
    } finally {
      setFavoriteBusy((items) => items.filter((x) => x !== id));
    }
  };
  const addCompare = (id: string) => {
    if (journey.compare.includes(id)) {
      setModal({ type: 'compare' });
      return;
    }
    if (journey.compare.length === 2) {
      setModal({ type: 'replace', id });
      return;
    }
    const compare = [...journey.compare, id];
    apply({ ...journey, compare }, true, ready);
    if (compare.length === 2) setModal({ type: 'compare' });
    else notify('已加入比较。再选择一座城市，就能并排阅读。');
  };
  const openStory = async (id: string) => {
    setModal({ type: 'story', id });
    try {
      const data = await api<{ place: Place }>(`/api/places/${id}`);
      setAllPlaces((items) => items.map((p) => (p.id === id ? data.place : p)));
    } catch {
      notify('详情接口暂不可用，正在展示本地收录内容。', true);
    }
  };
  const share = async () => {
    if (!ready) {
      notify('旅程尚未连接，请先重试。', true);
      return;
    }
    setSharing(true);
    try {
      await saveQueue.current;
      await api('/api/journey', { method: 'PATCH', body: JSON.stringify(stateRef.current) });
      const data = await api<{ url: string; token: string }>('/api/journey/share', {
        method: 'POST',
        body: JSON.stringify({ name: `沿着${latitudeLabel(journey.latitude)}的旅程` }),
      });
      setModal({ type: 'share', url: new URL(data.url, window.location.origin).href });
    } catch {
      notify('分享快照未能创建，请稍后重试。', true);
    } finally {
      setSharing(false);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('链接已复制。');
    } catch {
      notify('无法自动复制，请选中链接后复制。', true);
    }
  };
  const favoriteButton = (p: Place, compact = false) => (
    <button
      className={compact ? 'icon-button favorite-action' : 'secondary'}
      aria-label={`${favorites.includes(p.id) ? '取消收藏' : '收藏'}${p.name}`}
      aria-pressed={favorites.includes(p.id)}
      disabled={favoriteBusy.includes(p.id) || !ready}
      onClick={() => void toggleFavorite(p.id)}
    >
      <Bookmark size={17} fill={favorites.includes(p.id) ? 'currentColor' : 'none'} />
      {!compact && (favorites.includes(p.id) ? '已收藏' : '收藏城市')}
    </button>
  );
  const storyCity = modal?.type === 'story' ? allPlaces.find((p) => p.id === modal.id) : null;
  const navigateStory = (direction: number) => {
    if (!storyCity) return;
    const route = seedRoutes.find((route) => route.cityIds.includes(storyCity.id));
    const stops = currentPlaces.some((p) => p.id === storyCity.id)
      ? currentPlaces
      : allPlaces
          .filter((p) => route?.cityIds.includes(p.id))
          .sort((a, b) => a.longitude - b.longitude);
    const index = stops.findIndex((p) => p.id === storyCity.id);
    const next = stops[(index + direction + stops.length) % stops.length];
    if (next) {
      select(next.id);
      setModal({ type: 'story', id: next.id });
    }
  };
  return (
    <>
      <a className="skip-link" href="#city-list">
        跳到城市列表
      </a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="沿着一条纬线首页">
          <img src="/icon.svg" width="34" height="34" alt="" />
          <span>
            沿着一条纬线<small>ALONG A PARALLEL</small>
          </span>
        </Link>
        <nav aria-label="主导航">
          <a className="nav-active" href="#explore">
            探索世界
          </a>
          <button onClick={() => setModal({ type: 'journey' })}>
            我的旅程
            <span className="nav-count">{favorites.length.toString().padStart(2, '0')}</span>
          </button>
          <button onClick={() => setModal({ type: 'about' })}>关于</button>
        </nav>
        <span className="header-note">
          一部可以漫游的地理图册 <Globe2 size={15} />
        </span>
      </header>
      <main id="explore">
        <section className="intro">
          <div>
            <p className="eyebrow">
              <span className="tiny-line" /> A WORLD OF SHARED LATITUDES
            </p>
            <h1>
              同一条纬线，<span>很多种生活。</span>
            </h1>
            <p className="intro-copy">
              让好奇心沿着地球转一圈。山川、街巷与餐桌，
              <br className="desktop-break" />
              在相近的纬度，遇见截然不同的日常。
            </p>
          </div>
          <div className="edition">
            <span>地球漫游计划</span>
            <strong>VOL. 01</strong>
            <small>16 座城市 · 3 条精选纬度带</small>
          </div>
        </section>
        {bootError && (
          <div className="connection-error" role="alert">
            本地服务暂未连接，收藏与分享需要服务连接。
            <button onClick={() => void boot()}>重新连接</button>
          </div>
        )}
        <section className="exploration" aria-label="纬度探索">
          <div className="map-panel">
            <div className="route-tabs" role="group" aria-label="精选纬度带">
              {seedRoutes.map((route) => (
                <button
                  key={route.id}
                  className={journey.latitude === route.latitude ? 'selected' : ''}
                  onClick={() => setLatitude(route.latitude)}
                >
                  <span className="route-degree">
                    {Math.abs(route.latitude)}°<small>{route.latitude < 0 ? 'S' : 'N'}</small>
                  </span>
                  <span>
                    {route.latitude === 30
                      ? '山海与日常'
                      : route.latitude === 45
                        ? '河流与街巷'
                        : '南方的光'}
                  </span>
                  <span className="route-dot" />
                </button>
              ))}
            </div>
            <Globe
              latitude={journey.latitude}
              band={journey.band}
              places={currentPlaces}
              selected={journey.selectedCity}
              longitude={journey.longitude}
              onSelect={select}
              onStep={step}
              onLongitude={(longitude) => apply({ ...stateRef.current, longitude }, true, ready)}
            />
            <div className="map-legend">
              <span>
                <i className="legend-line" />
                精确纬线
              </span>
              <span>
                <i className="legend-band" />
                附近纬度带 ±{journey.band}°
              </span>
              <span>
                <i className="legend-dot" />
                真实城市坐标
              </span>
            </div>
            <div className="latitude-control">
              <label htmlFor="latitude">
                想去另一条纬线？<span>{latitudeLabel(journey.latitude)}</span>
              </label>
              <input
                id="latitude"
                aria-label="调整中心纬度"
                type="range"
                min="-90"
                max="90"
                step="1"
                value={journey.latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
              />
              <div>
                <span>90°S</span>
                <span>赤道</span>
                <span>90°N</span>
              </div>
            </div>
          </div>
          <div className="preview-panel">
            <div className="preview-topline">
              <span>
                <span className="live-dot" /> {latitudeLabel(journey.latitude)}附近 · ±
                {journey.band}°
              </span>
              <span>{currentPlaces.length} 座城市</span>
            </div>
            {city ? (
              <article className="city-preview" key={city.id}>
                <div className="city-name-row">
                  <div>
                    <p className="country-label">
                      {city.country} <span>/</span> {coordinate(city.latitude)}
                    </p>
                    <h2>
                      {city.name}
                      <span>{city.originalName}</span>
                    </h2>
                  </div>
                  {favoriteButton(city, true)}
                </div>
                <div className="city-meta">
                  <span>
                    <MapPin size={12} />
                    {coordinate(city.longitude, false)}
                  </span>
                  <span>
                    <span className="clock-dot" />
                    <LocalTime place={city} /> 当地时间
                  </span>
                </div>
                <Art place={city} priority />
                <div className="preview-story">
                  <p className="eyebrow">A GLIMPSE OF EVERYDAY LIFE</p>
                  <h3>{city.tagline}</h3>
                  <p>{city.intro}</p>
                </div>
                <div className="preview-actions">
                  <button className="primary" onClick={() => void openStory(city.id)}>
                    走进{city.name}的故事 <ArrowRight size={17} />
                  </button>
                  <button
                    className={`compare-add ${journey.compare.includes(city.id) ? 'is-added' : ''}`}
                    onClick={() => addCompare(city.id)}
                  >
                    <Layers2 size={16} />
                    {journey.compare.includes(city.id) ? '已选比较' : '加入比较'}
                  </button>
                </div>
              </article>
            ) : (
              <div className="empty-city">
                <Globe2 size={46} strokeWidth={1} />
                <p className="eyebrow">THE WORLD IS STILL HERE</p>
                <h2>让故事留一点空白</h2>
                <p>这一纬度带还没有收录城市。真实的海陆依然在这里，新的日常正等待被记录。</p>
                <button className="primary" onClick={() => setLatitude(30)}>
                  回到北纬 30° <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section
          id="city-list"
          tabIndex={-1}
          className="journey-strip"
          aria-label="当前纬度城市列表"
        >
          <div className="strip-heading">
            <div>
              <p className="eyebrow">YOUR JOURNEY ALONG THE PARALLEL</p>
              <h2>
                沿线，下一站
                <span>
                  {latitudeLabel(journey.latitude)}附近 · ±{journey.band}°
                </span>
              </h2>
            </div>
            <div className="journey-progress">
              <span>
                <i />
                {exploredCount} / {currentPlaces.length} 座已探索
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={!city}
                  onClick={() => step(-1)}
                  aria-label="向西一站"
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  disabled={!city}
                  onClick={() => step(1)}
                  aria-label="向东一站"
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="city-track">
            {currentPlaces.map((p, i) => (
              <button
                key={p.id}
                className={`city-stop ${p.id === city?.id ? 'active' : ''}`}
                onClick={() => select(p.id)}
                aria-pressed={p.id === city?.id}
              >
                <span className="stop-top">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {journey.explored.includes(p.id) ? (
                    <Check size={13} aria-label="已探索" />
                  ) : (
                    <span className="unseen-dot" />
                  )}
                </span>
                <strong>{p.name}</strong>
                <span className="stop-original">{p.originalName}</span>
                <span className="stop-coordinate">
                  {coordinate(p.longitude, false)}
                  {p.id === city?.id && <span>正在探索</span>}
                </span>
              </button>
            ))}
            {!currentPlaces.length && (
              <p className="empty-track">
                这一段还没有收录故事。<button onClick={() => setLatitude(30)}>回到北纬 30°</button>
              </p>
            )}
          </div>
          <div className="strip-footnote">
            <span>
              西 <span className="direction-rule" /> 东
            </span>
            <p>按经度排列的故事索引，不代表公路或航线。</p>
          </div>
        </section>
        <section className="editor-note">
          <span className="editor-mark">“</span>
          <p>
            纬度是一个开始，
            <br />
            <strong>生活的答案从来不止一种。</strong>
          </p>
          <div>
            <p>
              相近的日照，不同的山海与历史。
              <br />
              选择两座城市，让差异成为理解世界的线索。
            </p>
            <button onClick={() => setModal({ type: 'compare' })}>
              把两个地方放在一起 <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>
          沿着一条纬线 <small>© {new Date().getFullYear()} · 开源地理人文探索计划</small>
        </span>
        <div>
          <span className={saveFailed ? 'save-error' : ''}>
            {saveFailed
              ? '旅程保存失败'
              : saving
                ? '正在保存旅程…'
                : ready
                  ? '旅程已自动保存'
                  : '正在连接旅程…'}
          </span>
          {saveFailed && <button onClick={() => persist(stateRef.current)}>重试保存</button>}
          <button onClick={() => setModal({ type: 'about' })}>
            资料与地图来源 <ExternalLink size={12} />
          </button>
        </div>
      </footer>
      {journey.compare.length > 0 && modal?.type !== 'compare' && (
        <button className="compare-dock" onClick={() => setModal({ type: 'compare' })}>
          <Layers2 size={17} /> 城市比较 <span>{journey.compare.length} / 2</span>
          <ChevronRight size={15} />
        </button>
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? 'toast-error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{notice.text}</span>
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          title={
            modal.type === 'story'
              ? 'CITY FIELD NOTES · 城市手记'
              : modal.type === 'journey'
                ? 'MY ATLAS · 我的旅程'
                : modal.type === 'compare'
                  ? 'SIDE BY SIDE · 两地之间'
                  : modal.type === 'about'
                    ? 'ABOUT THE PROJECT · 关于计划'
                    : modal.type === 'replace'
                      ? 'CHOOSE A PLACE · 替换比较对象'
                      : 'SHARE A JOURNEY · 分享一段旅程'
          }
          onClose={() => setModal(null)}
          wide={modal.type === 'compare' || modal.type === 'story'}
        >
          {storyCity && (
            <article className="story-detail">
              <div className="story-title">
                <p className="country-label">
                  {storyCity.country} · {coordinate(storyCity.latitude)} /{' '}
                  {coordinate(storyCity.longitude, false)}
                </p>
                <h2>
                  {storyCity.name}
                  <small>{storyCity.originalName}</small>
                </h2>
                <p>{storyCity.tagline}</p>
                <span className="story-time">
                  此刻的当地时间 <LocalTime place={storyCity} />
                </span>
              </div>
              <Art place={storyCity} />
              <p className="story-intro">{storyCity.intro}</p>
              <div className="story-grid">
                {storyCity.stories.map((story, i) => (
                  <section key={story.theme}>
                    <p className="eyebrow">
                      0{i + 1} / {story.theme}
                    </p>
                    <h3>{story.title}</h3>
                    <p>{story.body}</p>
                  </section>
                ))}
              </div>
              <div className="story-buttons">
                {favoriteButton(storyCity)}
                <button className="secondary" onClick={() => addCompare(storyCity.id)}>
                  <Layers2 size={16} />
                  加入比较
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    select(storyCity.id);
                    setModal(null);
                  }}
                >
                  在地球上找到这里 <ArrowRight size={16} />
                </button>
              </div>
              <Sources place={storyCity} />
              <div className="story-navigation">
                <button onClick={() => navigateStory(-1)}>
                  <ArrowLeft size={16} />
                  向西一站
                </button>
                <button onClick={() => navigateStory(1)}>
                  向东一站
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          )}
          {modal.type === 'journey' && (
            <div className="journey-detail">
              <p className="eyebrow">A SMALL COLLECTION OF THE WORLD</p>
              <h2>
                把喜欢的地方，
                <br />
                留在自己的图册里。
              </h2>
              <div className="journey-summary">
                <span>
                  {favorites.length}
                  <small>座收藏城市</small>
                </span>
                <span>
                  {journey.explored.length}
                  <small>座已探索城市</small>
                </span>
                <span>
                  {Math.abs(journey.latitude)}°{journey.latitude < 0 ? 'S' : 'N'}
                  <small>当前纬度中心</small>
                </span>
              </div>
              <h3>我的收藏</h3>
              {!favorites.length ? (
                <p className="empty-note">
                  图册还是空的。点亮城市旁的书签，留住一段让你好奇的生活。
                </p>
              ) : (
                <div className="saved-list">
                  {favorites.map((id) => {
                    const p = allPlaces.find((p) => p.id === id);
                    return p ? (
                      <div key={id}>
                        <img src={p.image} alt="" width="80" height="64" />
                        <button
                          onClick={() => {
                            select(p.id);
                            setModal(null);
                          }}
                        >
                          <strong>{p.name}</strong>
                          <span>
                            {p.originalName} · {coordinate(p.latitude)}
                          </span>
                        </button>
                        {favoriteButton(p, true)}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              <h3>走过的地方</h3>
              <div className="explored-tags">
                {journey.explored.map((id) => {
                  const p = allPlaces.find((p) => p.id === id);
                  return p ? (
                    <button
                      key={id}
                      onClick={() => {
                        select(id);
                        setModal(null);
                      }}
                    >
                      <Check size={13} />
                      {p.name}
                    </button>
                  ) : null;
                })}
              </div>
              <div className="share-intro">
                <Share2 size={24} />
                <h3>分享此刻的旅程</h3>
                <p>
                  生成公开、只读的旅程快照。之后的私人更改不会改变这份分享；持有链接的人都可阅读。
                </p>
                <button
                  className="primary"
                  disabled={sharing || !ready}
                  onClick={() => void share()}
                >
                  {sharing ? <LoaderCircle size={17} className="spin" /> : <Share2 size={16} />}
                  创建分享链接
                </button>
              </div>
            </div>
          )}
          {modal.type === 'compare' && (
            <div className="comparison">
              <h2>
                相近的纬度，
                <br />
                怎样不同的生活？
              </h2>
              {journey.compare.length < 2 ? (
                <>
                  <p className="muted">选择两座城市，逐项阅读它们的自然与日常。</p>
                  <div className="compare-picker">
                    {allPlaces.map((p) => (
                      <button
                        key={p.id}
                        className={journey.compare.includes(p.id) ? 'picked' : ''}
                        onClick={() => addCompare(p.id)}
                      >
                        <span>
                          {p.name}
                          <small>{coordinate(p.latitude)}</small>
                        </span>
                        {journey.compare.includes(p.id) ? <Check size={16} /> : <span>＋</span>}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="compare-cities">
                    {journey.compare.map((id) => {
                      const p = allPlaces.find((p) => p.id === id)!;
                      return (
                        <div key={id}>
                          <Art place={p} />
                          <h3>
                            {p.name}
                            <small>{p.originalName}</small>
                          </h3>
                          <button
                            className="text-button"
                            onClick={() => {
                              apply(
                                { ...journey, compare: journey.compare.filter((x) => x !== id) },
                                true,
                                ready,
                              );
                            }}
                          >
                            替换城市 <ArrowRight size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="comparison-grid">
                    <h4>真实位置与当地时间</h4>
                    {journey.compare.map((id) => {
                      const p = allPlaces.find((p) => p.id === id)!;
                      return (
                        <div key={id}>
                          <strong>{coordinate(p.latitude)}</strong>
                          <span>
                            距 {latitudeLabel(journey.latitude)} 中心{' '}
                            {Math.abs(p.latitude - journey.latitude).toFixed(2)}°
                          </span>
                          <div className="latitude-ruler">
                            <i
                              style={{
                                left: `${Math.max(2, Math.min(98, ((p.latitude + 90) / 180) * 100))}%`,
                              }}
                            />
                          </div>
                          <small>
                            90°S <span>赤道</span> 90°N
                          </small>
                          <p>
                            {coordinate(p.longitude, false)} · <LocalTime place={p} />
                          </p>
                        </div>
                      );
                    })}
                    {[0, 1, 2, 3].map((index) => (
                      <div className="comparison-dimension" key={index}>
                        <h4>{['自然地理', '城市与建筑', '日常生活', '饮食文化'][index]}</h4>
                        {journey.compare.map((id) => {
                          const p = allPlaces.find((p) => p.id === id)!;
                          return (
                            <div key={id}>
                              <span className="mobile-city-label">{p.name}</span>
                              <h5>{p.stories[index]?.title}</h5>
                              <p>{p.stories[index]?.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="compare-observation">
                    <Sparkles size={20} />
                    <h3>把线索连起来</h3>
                    {compareText ? (
                      <>
                        <h4>相似之处</h4>
                        <p>{compareText.similarities}</p>
                        <h4>有趣的差异</h4>
                        <p>{compareText.differences}</p>
                      </>
                    ) : (
                      <p>
                        {compareError
                          ? '比较摘要暂时不可用。上方故事仍可逐项阅读。'
                          : '正在整理两地的共同线索…'}
                      </p>
                    )}
                    <p className="small-print">
                      人文描述以两地手记的资料为依据，不以纬度解释文化。点击城市故事查看对应来源。
                    </p>
                  </div>
                  <div className="compare-sources">
                    {journey.compare.map((id) => {
                      const p = allPlaces.find((p) => p.id === id)!;
                      return (
                        <button key={id} className="secondary" onClick={() => void openStory(id)}>
                          {p.name}的故事与来源 <ExternalLink size={13} />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {modal.type === 'replace' && (
            <div className="replace-panel">
              <Layers2 size={32} />
              <h2>比较席位已满</h2>
              <p>将{allPlaces.find((p) => p.id === modal.id)?.name}加入比较，需要替换一座城市。</p>
              {journey.compare.map((id, index) => (
                <button
                  className="secondary"
                  key={id}
                  onClick={() => {
                    const compare = [...journey.compare];
                    compare[index] = modal.id;
                    apply({ ...journey, compare }, true, ready);
                    setModal({ type: 'compare' });
                  }}
                >
                  替换{allPlaces.find((p) => p.id === id)?.name}
                  <ArrowRight size={16} />
                </button>
              ))}
              <button className="text-button" onClick={() => setModal(null)}>
                取消，保留当前比较
              </button>
            </div>
          )}
          {modal.type === 'share' && (
            <div className="share-panel">
              <Share2 size={32} />
              <h2>一段旅程，已经装订好。</h2>
              <p>
                这是创建此刻的公开快照，不会随您的收藏与路线更改。链接仅在部署此项目的服务可访问时有效。
              </p>
              <label htmlFor="share-url">只读分享链接</label>
              <div className="share-link">
                <input
                  id="share-url"
                  readOnly
                  value={modal.url}
                  onFocus={(e) => e.target.select()}
                />
                <button aria-label="复制分享链接" onClick={() => void copy(modal.url)}>
                  <Copy size={18} />
                </button>
              </div>
              {new URL(modal.url).hostname === '127.0.0.1' ||
              new URL(modal.url).hostname === 'localhost' ? (
                <p className="small-print">
                  当前运行于本机，此链接可在本机另一浏览器会话中打开。对外分享需将应用部署到有持久磁盘的服务器。
                </p>
              ) : null}
              <a className="primary" href={modal.url} target="_blank" rel="noreferrer">
                打开只读旅程 <ExternalLink size={16} />
              </a>
            </div>
          )}
          {modal.type === 'about' && (
            <div className="about-panel">
              <p className="eyebrow">ALONG A PARALLEL</p>
              <h2>
                用一条纬线，
                <br />
                打开理解世界的方式。
              </h2>
              <p>
                《沿着一条纬线》是一部可以漫游的地理人文图册。我们从相近的纬度出发，走进具体城市的山海、街巷与餐桌。相似的纬度只是相遇的契机，无法替代每个地方独有的历史。
              </p>
              <div className="about-facts">
                <span>
                  <Globe2 size={22} />
                  <strong>真实地理</strong>Natural Earth
                  1:110m，v5.1.2；公共领域海岸线与行政区几何，正射投影。
                </span>
                <span>
                  <Heart size={22} />
                  <strong>有据可循的故事</strong>16 座城市，3
                  个精选纬度带。每座城市的手记列有来源、范围与核验状态。
                </span>
                <span>
                  <Bookmark size={22} />
                  <strong>属于自己的图册</strong>匿名收藏与旅程保存在服务器 SQLite 数据库。随机
                  Cookie 用于识别同一浏览器。
                </span>
              </div>
              <h3>如何开始</h3>
              <p>
                选择一个纬度带，拖动地球，或点击下方城市。用左右方向键切换地点；走进故事、加入比较，将喜欢的地方收藏起来。
              </p>
              <h3>关于地图与内容</h3>
              <p>
                纬线是精确的；城市落在真实坐标上。纬度带使用中心上下各 2°
                的范围。城市按经度排序，不代表公路、航线或完整覆盖这条纬线上的文化。
              </p>
              <p>
                所有必要地图、城市插画和故事均放在本地，运行时不依赖第三方网络。图片为原创 SVG
                地景示意。文化资料为静态选编，当地时间通过 IANA 时区计算。
              </p>
              <p className="small-print">
                此项目采用 MIT 开源协议；完整来源和素材清单见项目中的 SOURCES.md 与
                assets-manifest.json。清除浏览器 Cookie 会失去当前匿名旅程的入口。
              </p>
              <a
                className="secondary"
                href="https://github.com/Sep1stZ/along-a-parallel"
                target="_blank"
                rel="noreferrer"
              >
                查看开源项目 <ExternalLink size={15} />
              </a>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
