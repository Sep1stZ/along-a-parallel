'use client';
/* Local artwork is intentionally rendered as ordinary SVG images: no image server or runtime network is needed. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Search,
  Download,
  Upload,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { summarizePlace, type Place, type PlaceSummary } from '@/lib/place-types';
import { observations } from '@/data/observations';
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
function LocalTime({ place }: { place: Pick<PlaceSummary, 'timezone'> }) {
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
function Art({ place, priority = false }: { place: PlaceSummary | Place; priority?: boolean }) {
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
      <h3>{place.stories.length ? '故事从哪里来' : '资料从哪里来'}</h3>
      <p>以具体地点与案例观察城市。资料核验状态随每项来源列出，插画不替代实景记录。</p>
      {place.sources.map((source, i) => (
        <a key={i} href={source.url} target="_blank" rel="noreferrer">
          <span>
            {source.title}
            <small>
              {source.publisher} · {source.status === 'verified' ? '已核验' : '待进一步核验'} ·{' '}
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
type Catalog = {
  total: number;
  curatedTotal: number;
  version: string;
  coverage: { latitude: number; count: number; curatedCount: number }[];
};
type PlaceList = { places: PlaceSummary[]; total: number; curatedTotal: number; hasMore: boolean };
type OwnedShare = { token: string; name: string; createdAt: string; revokedAt?: string | null };
export default function Explorer() {
  const [journey, setJourney] = useState<Journey>(initial);
  const stateRef = useRef(journey);
  const [allPlaces, setAllPlaces] = useState<PlaceSummary[]>([]);
  const [details, setDetails] = useState<Record<string, Place>>({});
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [bandIds, setBandIds] = useState<string[]>([]);
  const [curatedIds, setCuratedIds] = useState<string[]>([]);
  const [bandTotal, setBandTotal] = useState(0);
  const [curatedTotal, setCuratedTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [bandLoading, setBandLoading] = useState(false);
  const [bandError, setBandError] = useState(false);
  const [bandRevision, setBandRevision] = useState(0);
  const [level, setLevel] = useState<'all' | 'curated'>('all');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSummary[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [saving, setSaving] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [ownedShares, setOwnedShares] = useState<OwnedShare[]>([]);
  const [sharesFailed, setSharesFailed] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const [compareResult, setCompareResult] = useState<{
    ids: string;
    similarities: string;
    differences: string;
    metrics?: {
      latitudeDifference: number;
      elevationDifference: number | null;
      climateNote: string;
    };
  } | null>(null);
  const [compareErrorIds, setCompareErrorIds] = useState<string | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingVisited = useRef(new Set<string>());
  const listEpoch = useRef(0);
  const mounted = useRef(false);
  const navigation = useRef(0);
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  const upsert = useCallback(
    (places: PlaceSummary[]) =>
      setAllPlaces((current) => {
        const map = new Map(current.map((p) => [p.id, p]));
        places.forEach((p) => map.set(p.id, p));
        return [...map.values()];
      }),
    [],
  );
  const hydrate = useCallback(
    async (ids: string[]) => {
      const result: PlaceSummary[] = [];
      for (let start = 0; start < ids.length; start += 200) {
        const data = await api<{ places: PlaceSummary[] }>(
          `/api/places?ids=${ids.slice(start, start + 200).join(',')}`,
        );
        result.push(...data.places);
      }
      upsert(result);
      return result;
    },
    [upsert],
  );
  const loadDetail = useCallback(
    async (id: string) => {
      const data = await api<{ place: Place }>(`/api/places/${encodeURIComponent(id)}`);
      setDetails((current) => ({ ...current, [id]: data.place }));
      upsert([summarizePlace(data.place)]);
      return data.place;
    },
    [upsert],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 8500 : 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const persist = useCallback(
    (next: Journey) => {
      const { explored: _explored, ...position } = next;
      void _explored;
      if (next.selectedCity) pendingVisited.current.add(next.selectedCity);
      setSaving((n) => n + 1);
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(async () => {
          if (!pendingVisited.current.size)
            await api('/api/journey', { method: 'PATCH', body: JSON.stringify(position) });
          for (const visited of [...pendingVisited.current]) {
            await api('/api/journey', {
              method: 'PATCH',
              body: JSON.stringify({ ...position, visited }),
            });
            pendingVisited.current.delete(visited);
          }
        })
        .then(() => {
          if (!pendingVisited.current.size) setSaveFailed(false);
        })
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
      const [data, fav, meta] = await Promise.all([
        api<{ journey: Journey }>('/api/journey'),
        api<{ favorites: string[] }>('/api/favorites'),
        api<Catalog>('/api/catalog'),
      ]);
      setFavorites(fav.favorites);
      setCatalog(meta);
      let parsed = parseExplore(window.location.search);
      if (parsed) {
        const ids = [
          ...new Set([parsed.selectedCity, ...parsed.compare].filter((id): id is string => !!id)),
        ];
        const found = ids.length ? await hydrate(ids) : [];
        if (found.length !== ids.length) parsed = null;
        else if (parsed.selectedCity) {
          const selected = found.find((p) => p.id === parsed!.selectedCity)!;
          if (!new URLSearchParams(window.location.search).has('lng'))
            parsed.longitude = selected.longitude;
          if (!inBand(selected.latitude, parsed.latitude, parsed.band))
            parsed.latitude = selected.latitude;
        }
      }
      if (window.location.search && !parsed) notify('链接参数无效，已恢复您上次的旅程。', true);
      let next: Journey = { ...data.journey, ...(parsed || {}) };
      if (!next.selectedCity) {
        const nearby = await api<{ place: PlaceSummary | null }>(
          `/api/places/nearby?latitude=${next.latitude}&band=${next.band}&longitude=${next.longitude}&direction=nearest`,
        );
        if (nearby.place) {
          upsert([nearby.place]);
          next = { ...next, selectedCity: nearby.place.id, longitude: nearby.place.longitude };
        }
      }
      await hydrate([
        ...new Set([
          ...fav.favorites.slice(-200),
          ...next.explored.slice(-200),
          ...next.compare,
          ...(next.selectedCity ? [next.selectedCity] : []),
        ]),
      ]);
      if (next.selectedCity) next.explored = [...new Set([...next.explored, next.selectedCity])];
      stateRef.current = next;
      setJourney(next);
      setReady(true);
      window.history.replaceState({}, '', exploreUrl(next));
      if (parsed?.compare.length === 2) setModal({ type: 'compare' });
      persist(next);
    } catch {
      setBootError(true);
      notify('暂时无法连接服务。重试后即可继续保存旅程。', true);
    }
  }, [hydrate, notify, persist, upsert]);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void boot();
    }
  }, [boot]);
  useEffect(() => {
    const listener = async () => {
      const parsed = parseExplore(window.location.search);
      if (!parsed) {
        notify('链接参数无效，无法恢复该位置。', true);
        return;
      }
      try {
        const ids = [
          ...new Set([parsed.selectedCity, ...parsed.compare].filter((id): id is string => !!id)),
        ];
        const found = await hydrate(ids);
        if (found.length !== ids.length) throw new Error();
        apply({ ...stateRef.current, ...parsed }, false, ready);
        setModal(parsed.compare.length === 2 ? { type: 'compare' } : null);
      } catch {
        notify('链接中的城市暂时无法读取。', true);
      }
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, [apply, hydrate, notify, ready]);
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    listEpoch.current++;
    // A new externally selected latitude invalidates the previous paginated response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBandLoading(true);
    setBandError(false);
    setBandIds([]);
    setCuratedIds([]);
    setOffset(0);
    Promise.all([
      api<PlaceList>(
        `/api/places?latitude=${journey.latitude}&band=${journey.band}&level=${level}&limit=60&offset=0`,
        { signal: abort.signal },
      ),
      api<PlaceList>(
        `/api/places?latitude=${journey.latitude}&band=${journey.band}&level=curated&limit=60`,
        { signal: abort.signal },
      ),
    ])
      .then(([data, curated]) => {
        upsert([...data.places, ...curated.places]);
        setCuratedIds(curated.places.map((p) => p.id));
        setBandIds(data.places.map((p) => p.id));
        setBandTotal(data.total);
        setCuratedTotal(curated.total);
        setHasMore(data.hasMore);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setBandError(true);
          notify('城市列表暂未加载，请重试。', true);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setBandLoading(false);
      });
    return () => abort.abort();
  }, [journey.latitude, journey.band, level, ready, upsert, notify, bandRevision]);
  useEffect(() => {
    if (!journey.selectedCity || details[journey.selectedCity]) return;
    void Promise.resolve()
      .then(() => loadDetail(journey.selectedCity!))
      .catch(() => notify('城市详情暂未加载，可点击详情按钮重试。', true));
  }, [journey.selectedCity, details, loadDetail, notify]);
  useEffect(() => {
    if (!query.trim()) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      api<PlaceList>(`/api/places?q=${encodeURIComponent(query.trim())}&limit=12`, {
        signal: abort.signal,
      })
        .then((data) => {
          setSearchResults(data.places);
          setSearchTotal(data.total);
          upsert(data.places);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setSearchFailed(true);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearchBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, upsert]);
  const comparisonIds = journey.compare.join(',');
  useEffect(() => {
    if (modal?.type !== 'compare' || journey.compare.length !== 2) return;
    let active = true;
    Promise.all([
      api<{
        similarities: string;
        differences: string;
        metrics?: {
          latitudeDifference: number;
          elevationDifference: number | null;
          climateNote: string;
        };
      }>(`/api/compare?ids=${comparisonIds}`),
      ...journey.compare.map((id) => loadDetail(id)),
    ])
      .then(([data]) => {
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
  }, [modal?.type, comparisonIds, journey.compare, loadDetail]);
  useEffect(() => {
    if (modal?.type !== 'journey') return;
    api<{ shares: OwnedShare[] }>('/api/shares')
      .then((data) => {
        setOwnedShares(data.shares);
        setSharesFailed(false);
      })
      .catch(() => setSharesFailed(true));
    void Promise.resolve()
      .then(() =>
        hydrate([...new Set([...favorites.slice(-200), ...journey.explored.slice(-200)])]),
      )
      .catch(() => notify('部分旅程地名暂未加载。', true));
  }, [modal?.type, favorites, journey.explored, hydrate, notify]);
  const compareText = compareResult?.ids === comparisonIds ? compareResult : null;
  const compareError = compareErrorIds === comparisonIds;
  const placeMap = useMemo(() => new Map(allPlaces.map((p) => [p.id, p])), [allPlaces]);
  const currentPlaces = bandIds.map((id) => placeMap.get(id)).filter((p): p is PlaceSummary => !!p);
  const city = journey.selectedCity ? placeMap.get(journey.selectedCity) || null : null;
  const cityDetail = city ? details[city.id] : null;
  const curatedBand = curatedIds
    .map((id) => placeMap.get(id))
    .filter((p): p is PlaceSummary => !!p);
  const mapPlaces = [
    ...new Map(
      [
        ...currentPlaces,
        ...curatedBand,
        ...(city && inBand(city.latitude, journey.latitude, journey.band) ? [city] : []),
      ].map((p) => [p.id, p]),
    ).values(),
  ];
  const nearbyObservations = observations
    .filter((p) => inBand(p.latitude, journey.latitude, journey.band))
    .slice(0, 3);
  const nearestBands =
    catalog?.coverage
      .filter((p) => p.count > 0 && Math.abs(p.latitude - journey.latitude) > journey.band)
      .sort(
        (a, b) => Math.abs(a.latitude - journey.latitude) - Math.abs(b.latitude - journey.latitude),
      )
      .slice(0, 2) || [];
  const select = (id: string) => {
    const p = placeMap.get(id);
    if (!p) return;
    navigation.current++;
    const base = stateRef.current;
    apply(
      {
        ...base,
        selectedCity: id,
        longitude: p.longitude,
        latitude: inBand(p.latitude, base.latitude, base.band) ? base.latitude : p.latitude,
        explored: [...new Set([...base.explored, id])],
      },
      true,
      ready,
    );
  };
  const moveBand = async (
    latitude: number,
    band = stateRef.current.band,
    scope: 'all' | 'curated' = level,
  ) => {
    const request = ++navigation.current;
    const base = stateRef.current;
    apply({ ...base, latitude, band, selectedCity: null }, true, ready);
    try {
      const preferred =
        latitude === 30 ? 'hangzhou' : latitude === 45 ? 'venice' : latitude === -23 ? 'rio' : null;
      const result =
        preferred && scope === 'all'
          ? await api<{ place: Place }>(`/api/places/${preferred}`).then((d) => ({
              place: summarizePlace(d.place),
            }))
          : await api<{ place: PlaceSummary | null }>(
              `/api/places/nearby?latitude=${latitude}&band=${band}&longitude=${base.longitude}&direction=nearest&level=${scope}`,
            );
      if (request !== navigation.current) return;
      if (result.place && inBand(result.place.latitude, latitude, band)) {
        upsert([result.place]);
        const next = stateRef.current;
        apply(
          {
            ...next,
            selectedCity: result.place.id,
            longitude: result.place.longitude,
            explored: [...new Set([...next.explored, result.place.id])],
          },
          false,
          ready,
        );
        window.history.replaceState({}, '', exploreUrl(stateRef.current));
      }
    } catch {
      notify('附近地点暂未读取，可从城市列表选择。', true);
    }
  };
  const setLatitude = (latitude: number) => void moveBand(latitude);
  const step = async (direction: number, story = false) => {
    const base = stateRef.current;
    const request = ++navigation.current;
    try {
      const result = await api<{ place: PlaceSummary | null }>(
        `/api/places/nearby?latitude=${base.latitude}&band=${base.band}&longitude=${base.longitude}&direction=${direction > 0 ? 'east' : 'west'}&level=${level}${base.selectedCity ? `&from=${base.selectedCity}` : ''}`,
      );
      if (request !== navigation.current || !result.place) return;
      upsert([result.place]);
      apply(
        {
          ...base,
          selectedCity: result.place.id,
          longitude: result.place.longitude,
          explored: [...new Set([...base.explored, result.place.id])],
        },
        true,
        ready,
      );
      if (story) {
        setModal({ type: 'story', id: result.place.id });
        await loadDetail(result.place.id);
      }
    } catch {
      notify('下一站暂未加载，请重试。', true);
    }
  };
  const loadMore = async () => {
    const epoch = listEpoch.current;
    const base = stateRef.current;
    setBandLoading(true);
    try {
      const data = await api<PlaceList>(
        `/api/places?latitude=${base.latitude}&band=${base.band}&level=${level}&limit=60&offset=${offset + 60}`,
      );
      if (
        epoch !== listEpoch.current ||
        base.latitude !== stateRef.current.latitude ||
        base.band !== stateRef.current.band
      )
        return;
      upsert(data.places);
      setBandIds(data.places.map((p) => p.id));
      setOffset(offset + 60);
      setHasMore(data.hasMore);
    } catch {
      notify('下一页暂未加载。', true);
    } finally {
      setBandLoading(false);
    }
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
    if (!details[id])
      try {
        await loadDetail(id);
      } catch {
        notify('详情暂未加载，请稍后重试。', true);
      }
  };
  const share = async () => {
    if (favoriteBusy.length) {
      notify('收藏正在保存，请稍候。');
      return;
    }
    if (!ready) {
      notify('旅程尚未连接，请先重试。', true);
      return;
    }
    setSharing(true);
    try {
      await saveQueue.current;
      if (pendingVisited.current.size) throw new Error('旅程仍有未保存记录，请先重试保存');
      const { explored: _explored, ...position } = stateRef.current;
      void _explored;
      await api('/api/journey', { method: 'PATCH', body: JSON.stringify(position) });
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
  const exportJourney = async () => {
    if (favoriteBusy.length) {
      notify('收藏正在保存，请稍候。');
      return;
    }
    setTransferBusy(true);
    try {
      await saveQueue.current;
      if (pendingVisited.current.size) throw new Error('旅程仍有未保存记录，请先重试保存');
      const { explored: _explored, ...position } = stateRef.current;
      void _explored;
      await api('/api/journey', { method: 'PATCH', body: JSON.stringify(position) });
      const data = await api('/api/journey/export');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `沿着一条纬线-旅程-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('旅程已导出，可在另一浏览器导入。');
    } catch {
      notify('导出失败，请重试。', true);
    } finally {
      setTransferBusy(false);
    }
  };
  const importJourney = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      notify('请选择小于 2 MB 的旅程 JSON 文件。', true);
      return;
    }
    setTransferBusy(true);
    try {
      const data = JSON.parse(await file.text());
      await saveQueue.current;
      if (pendingVisited.current.size) throw new Error('旅程仍有未保存记录，请先重试保存');
      await api('/api/journey/import', { method: 'POST', body: JSON.stringify(data) });
      window.history.replaceState({}, '', '/');
      await boot();
      notify('已合并旅程与收藏。');
    } catch {
      notify('导入失败，请检查文件格式及城市是否有效。', true);
    } finally {
      setTransferBusy(false);
      if (importInput.current) importInput.current.value = '';
    }
  };
  const revoke = async (token: string) => {
    try {
      await api(`/api/shares/${token}`, { method: 'DELETE' });
      setOwnedShares((items) =>
        items.map((s) => (s.token === token ? { ...s, revokedAt: new Date().toISOString() } : s)),
      );
      notify('分享已撤销，原链接无法继续读取。');
    } catch {
      notify('撤销失败，请重试。', true);
    }
  };
  const favoriteButton = (p: PlaceSummary | Place, compact = false) => (
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
  const storyCity = modal?.type === 'story' ? details[modal.id] : null;
  const navigateStory = (direction: number) => {
    if (!storyCity) return;
    const route = seedRoutes.find((r) => r.cityIds.includes(storyCity.id));
    if (!route) {
      void step(direction, true);
      return;
    }
    void hydrate(route.cityIds)
      .then((found) => {
        const stops = found.sort((a, b) => a.longitude - b.longitude);
        const index = stops.findIndex((p) => p.id === storyCity.id);
        const next = stops[(index + direction + stops.length) % stops.length];
        if (next) {
          upsert([next]);
          const base = stateRef.current;
          apply(
            {
              ...base,
              latitude: route.latitude,
              band: route.band,
              selectedCity: next.id,
              longitude: next.longitude,
              explored: [...new Set([...base.explored, next.id])],
            },
            true,
            ready,
          );
          void openStory(next.id);
        }
      })
      .catch(() => notify('下一站暂未读取。', true));
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
            <strong>VOL. 02</strong>
            <small>
              {catalog ? catalog.total.toLocaleString() : '全球'} 个地点 ·{' '}
              {catalog?.curatedTotal ?? '—'} 篇精选手记
            </small>
          </div>
        </section>
        {bootError && (
          <div className="connection-error" role="alert">
            本地服务暂未连接，收藏与分享需要服务连接。
            <button onClick={() => void boot()}>重新连接</button>
          </div>
        )}
        <section className="atlas-search" aria-label="全球地点搜索">
          <div className="search-field">
            <Search size={20} />
            <label className="sr-only" htmlFor="city-search">
              搜索城市、英文名或别名
            </label>
            <input
              id="city-search"
              placeholder="从一个地名出发，例如：东京 / Tokyo"
              value={query}
              maxLength={100}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchBusy(!!e.target.value.trim());
                setSearchFailed(false);
              }}
              autoComplete="off"
            />
            {query && (
              <button aria-label="清空搜索" onClick={() => setQuery('')}>
                ×
              </button>
            )}
          </div>
          <span className="search-hint">全球地点资料 · 中文 / English</span>
          {query.trim() && (
            <div className="search-results" aria-live="polite">
              <p>
                {searchBusy
                  ? '正在寻找地点…'
                  : searchFailed
                    ? '搜索暂时不可用，请稍后重试。'
                    : `找到 ${searchTotal.toLocaleString()} 个地点${searchTotal > 12 ? '，显示前 12 个，请补充地名缩小范围' : ''}`}
              </p>
              {!searchBusy &&
                !searchFailed &&
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      select(p.id);
                      setQuery('');
                    }}
                  >
                    <MapPin size={16} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.originalName} · {p.country}
                        {p.admin ? ` · ${p.admin}` : ''}
                      </small>
                    </span>
                    <span className="place-badge">{p.hasStory ? '精选手记' : '地点资料'}</span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              {!searchBusy && !searchFailed && !searchResults.length && (
                <p>试试英文名或更短的关键词。尚未收录的地点不会用虚构内容补齐。</p>
              )}
            </div>
          )}
        </section>
        <section className="exploration" aria-label="纬度探索">
          <div className="map-panel">
            <div className="route-tabs" role="group" aria-label="精选纬度带">
              {seedRoutes.map((route) => (
                <button
                  key={route.id}
                  className={journey.latitude === route.latitude ? 'selected' : ''}
                  title={route.description}
                  onClick={() => void moveBand(route.latitude, route.band)}
                >
                  <span className="route-degree">
                    {Math.abs(route.latitude)}°
                    <small>{route.latitude === 0 ? '' : route.latitude < 0 ? 'S' : 'N'}</small>
                  </span>
                  <span>{route.name}</span>
                  <span className="route-dot" />
                </button>
              ))}
            </div>
            <p className="route-scroll-hint">8 条精选路线 · 左右滑动查看</p>
            <Globe
              latitude={journey.latitude}
              band={journey.band}
              places={mapPlaces}
              selected={journey.selectedCity}
              longitude={journey.longitude}
              onSelect={select}
              onStep={(direction) => void step(direction)}
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
            <div className="coverage-panel">
              <div className="coverage-heading">
                <span>全球地点覆盖</span>
                <small>柱高表示各整度纬带 ±2° 的地点数</small>
              </div>
              <div className="coverage-bars" aria-label="纬度地点密度">
                {catalog?.coverage.map((p) => (
                  <button
                    key={p.latitude}
                    title={`${latitudeLabel(p.latitude)}：${p.count} 个地点`}
                    aria-label={`前往${latitudeLabel(p.latitude)}，${p.count}个地点`}
                    className={Math.abs(p.latitude - journey.latitude) < 1 ? 'active' : ''}
                    onClick={() => setLatitude(p.latitude)}
                    style={{
                      height: `${Math.max(3, (Math.log1p(p.count) / Math.log1p(Math.max(...catalog.coverage.map((c) => c.count)))) * 32)}px`,
                    }}
                  />
                ))}
              </div>
              <div className="band-options" role="group" aria-label="纬度范围">
                <span>探索范围</span>
                {[1, 2, 5, 10].map((b) => (
                  <button
                    key={b}
                    aria-pressed={journey.band === b}
                    onClick={() => void moveBand(journey.latitude, b)}
                  >
                    ±{b}°
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="preview-panel">
            <div className="preview-topline">
              <span>
                <span className="live-dot" /> {latitudeLabel(journey.latitude)}附近 · ±
                {journey.band}°
              </span>
              <span>{bandLoading ? '读取中…' : `${bandTotal.toLocaleString()} 个地点`}</span>
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
                  <p className="eyebrow">
                    {city.hasStory ? 'CITY FIELD NOTES · 精选手记' : 'PLACE RECORD · 地点资料'}
                  </p>
                  <h3>
                    {cityDetail?.tagline ||
                      (city.hasStory ? '正在翻开城市手记…' : `${city.country}的一个真实地点`)}
                  </h3>
                  <p>
                    {cityDetail?.intro ||
                      `${city.name}位于${coordinate(city.latitude)}、${coordinate(city.longitude, false)}。从真实位置与当地时间开始认识这里。`}
                  </p>
                </div>
                <div className="preview-actions">
                  <button className="primary" onClick={() => void openStory(city.id)}>
                    {city.hasStory ? `走进${city.name}的故事` : `查看${city.name}的资料`}{' '}
                    <ArrowRight size={17} />
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
                <h2>
                  {bandLoading
                    ? '正在展开这一段世界'
                    : bandError
                      ? '地点列表暂未展开'
                      : level === 'curated'
                        ? '这里的故事还在编写'
                        : '这一带暂未收录地点'}
                </h2>
                <p>
                  {level === 'curated'
                    ? '切换到全部地点，可以继续查看真实位置与当地时间。'
                    : '目录以 GeoNames 聚落为主；海洋与极地的空白不代表没有地理内容。可以扩大范围，或前往邻近纬度。'}
                </p>
                {level === 'curated' && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setLevel('all');
                      if (!city) void moveBand(journey.latitude, journey.band, 'all');
                    }}
                  >
                    查看全部地点
                  </button>
                )}
                {bandError && (
                  <button className="secondary" onClick={() => setBandRevision((n) => n + 1)}>
                    重新加载列表
                  </button>
                )}
                <div className="nearest-bands">
                  {nearestBands.map((p) => (
                    <button
                      className="text-button"
                      key={p.latitude}
                      onClick={() => setLatitude(p.latitude)}
                    >
                      前往{latitudeLabel(p.latitude)} <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
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
                已探索 {journey.explored.length.toLocaleString()} 个地点
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={!city}
                  onClick={() => void step(-1)}
                  aria-label="向西一站"
                >
                  <ArrowLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  disabled={!city}
                  onClick={() => void step(1)}
                  aria-label="向东一站"
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="list-controls">
            <div className="tier-switch" role="group" aria-label="内容筛选">
              <button
                aria-pressed={level === 'all'}
                onClick={() => {
                  setLevel('all');
                  if (!city) void moveBand(journey.latitude, journey.band, 'all');
                }}
              >
                全部地点
              </button>
              <button
                aria-pressed={level === 'curated'}
                onClick={() => {
                  setLevel('curated');
                  void moveBand(journey.latitude, journey.band, 'curated');
                }}
              >
                精选手记
              </button>
            </div>
            <p>
              {bandTotal.toLocaleString()} 个{level === 'curated' ? '精选地点' : '地点'} ·{' '}
              {curatedTotal} 篇精选手记
              {currentPlaces.length > 0
                ? ` · 当前 ${offset + 1}–${offset + currentPlaces.length}`
                : ''}
            </p>
          </div>
          {level === 'all' && curatedBand.length > 0 && (
            <div className="curated-track" aria-label="这一带的精选手记">
              <span>先读一篇手记</span>
              {curatedBand.map((p) => (
                <button
                  key={p.id}
                  className={city?.id === p.id ? 'active' : ''}
                  onClick={() => select(p.id)}
                >
                  {p.name}
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
          )}
          <div className="city-track">
            {currentPlaces.map((p, i) => (
              <button
                key={p.id}
                className={`city-stop ${p.id === city?.id ? 'active' : ''}`}
                onClick={() => select(p.id)}
                aria-pressed={p.id === city?.id}
              >
                <span className="stop-top">
                  <span>{String(offset + i + 1).padStart(2, '0')}</span>
                  {journey.explored.includes(p.id) ? (
                    <Check size={13} aria-label="已探索" />
                  ) : (
                    <span className="unseen-dot" />
                  )}
                </span>
                <strong>{p.name}</strong>
                <span className="stop-original">
                  {p.country} · {p.originalName}
                </span>
                <span className="place-badge">{p.hasStory ? '精选手记' : '地点资料'}</span>
                <span className="stop-coordinate">
                  {coordinate(p.longitude, false)}
                  {p.id === city?.id && <span>正在探索</span>}
                </span>
              </button>
            ))}
            {!currentPlaces.length && (
              <p className="empty-track">
                {bandLoading
                  ? '正在加载地点…'
                  : bandError
                    ? '加载失败。'
                    : '请调整纬度、扩大范围，或切换内容筛选。'}
                <button onClick={() => setLatitude(30)}>回到北纬 30°</button>
              </p>
            )}
          </div>
          <div className="pagination">
            <button
              className="secondary"
              disabled={!offset || bandLoading}
              onClick={() => {
                setBandRevision((n) => n + 1);
              }}
            >
              回到第一页
            </button>
            <button
              className="secondary"
              disabled={!hasMore || bandLoading}
              onClick={() => void loadMore()}
            >
              {bandLoading ? '正在加载…' : '下一页地点'} <ArrowRight size={15} />
            </button>
            <small>每页最多 60 个地点，向东 / 向西可在整个纬度带漫游。</small>
          </div>
          <div className="strip-footnote">
            <span>
              西 <span className="direction-rule" /> 东
            </span>
            <p>当前页按经度排列，地图聚合邻近标记；不代表公路或航线。</p>
          </div>
        </section>
        {nearbyObservations.length > 0 && (
          <section className="geography-notes" aria-label="沿线自然观察">
            <div>
              <p className="eyebrow">BEYOND THE CITIES</p>
              <h2>城市之外，还有山海。</h2>
              <p>这一纬度附近的地理线索</p>
            </div>
            {nearbyObservations.map((p) => (
              <article key={p.id}>
                <span className="place-badge">
                  {
                    {
                      ocean: '海洋',
                      mountain: '山地',
                      desert: '沙漠',
                      polar: '极地',
                      island: '岛屿',
                      river: '河流',
                    }[p.kind]
                  }{' '}
                  · {coordinate(p.latitude)}
                </span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                {p.sources[0] && (
                  <a href={p.sources[0].url} target="_blank" rel="noreferrer">
                    资料来源 · {p.sources[0].publisher} ·{' '}
                    {p.sources[0].status === 'verified' ? '已核验' : '待核验'}{' '}
                    <ExternalLink size={12} />
                  </a>
                )}
              </article>
            ))}
          </section>
        )}
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
          {modal.type === 'story' && !storyCity && (
            <div className="detail-loading">
              <LoaderCircle className="spin" size={24} />
              <p>正在读取地点资料…</p>
              <button className="secondary" onClick={() => void openStory(modal.id)}>
                重新加载
              </button>
            </div>
          )}
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
              {!storyCity.stories.length && (
                <div className="catalog-record">
                  <span className="place-badge">地点资料 · 尚无精选手记</span>
                  <p>这里已收录真实地理位置与时区，编辑故事尚未编写。</p>
                  <dl>
                    <div>
                      <dt>国家 / 地区</dt>
                      <dd>
                        {storyCity.country}
                        {storyCity.admin ? ` · ${storyCity.admin}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>时区</dt>
                      <dd>{storyCity.timezone}</dd>
                    </div>
                    <div>
                      <dt>点位海拔</dt>
                      <dd>
                        {typeof storyCity.elevation === 'number'
                          ? `${storyCity.elevation.toLocaleString()} m（GeoNames）`
                          : '暂无已收录数据'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
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
              <div className="journey-tools">
                <button
                  className="secondary"
                  disabled={transferBusy || favoriteBusy.length > 0}
                  onClick={() => void exportJourney()}
                >
                  <Download size={16} />
                  导出旅程
                </button>
                <button
                  className="secondary"
                  disabled={transferBusy || favoriteBusy.length > 0}
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={16} />
                  导入并合并
                </button>
                <input
                  ref={importInput}
                  type="file"
                  accept="application/json,.json"
                  aria-label="导入旅程文件"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importJourney(file);
                  }}
                />
                <p>
                  {favoriteBusy.length
                    ? '正在保存收藏，完成后即可导出、导入或分享。'
                    : '导出的 JSON 可保存收藏与探索记录。导入会合并现有记录；请妥善保存文件。'}
                </p>
              </div>
              <h3>我的收藏</h3>
              {!favorites.length ? (
                <p className="empty-note">
                  图册还是空的。点亮城市旁的书签，留住一段让你好奇的生活。
                </p>
              ) : (
                <div className="saved-list">
                  {favorites.slice(-200).map((id) => {
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
              {favorites.length > 200 && (
                <p className="small-print">显示最近 200 个收藏；导出文件包含完整收藏。</p>
              )}
              <h3>走过的地方</h3>
              <div className="explored-tags">
                {journey.explored.slice(-200).map((id) => {
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
              {journey.explored.length > 200 && (
                <p className="small-print">显示最近 200 个地点；导出文件包含完整探索记录。</p>
              )}
              <div className="owned-shares">
                <h3>我的公开分享</h3>
                {sharesFailed ? (
                  <p>分享列表暂未读取，重新打开旅程可重试。</p>
                ) : !ownedShares.length ? (
                  <p className="muted">尚未创建分享快照。</p>
                ) : (
                  ownedShares.map((s) => (
                    <div key={s.token}>
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {new Date(s.createdAt).toLocaleDateString('zh-CN')} ·{' '}
                          {s.revokedAt ? '已撤销' : '公开只读'}
                        </small>
                      </span>
                      {!s.revokedAt && (
                        <>
                          <button
                            className="icon-button"
                            aria-label={`复制${s.name}的分享`}
                            onClick={() =>
                              void copy(new URL(`/shared/${s.token}`, window.location.origin).href)
                            }
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`撤销${s.name}的分享`}
                            onClick={() => void revoke(s.token)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="share-intro">
                <Share2 size={24} />
                <h3>分享此刻的旅程</h3>
                <p>
                  生成公开、只读的旅程快照，最多包含 60
                  个完整地点。之后的私人更改不会改变这份分享；可在此撤销链接。
                </p>
                <button
                  className="primary"
                  disabled={sharing || !ready || favoriteBusy.length > 0}
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
                    {allPlaces.slice(-60).map((p) => (
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
                      const p = placeMap.get(id);
                      if (!p) return null;
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
                      const p = placeMap.get(id);
                      if (!p) return null;
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
                          const p = placeMap.get(id);
                          if (!p) return null;
                          return (
                            <div key={id}>
                              <span className="mobile-city-label">{p.name}</span>
                              <h5>
                                {details[id]?.stories.find(
                                  (story) =>
                                    story.theme ===
                                    ['自然地理', '城市与建筑', '日常生活', '饮食文化'][index],
                                )?.title || (p.hasStory ? '手记正在读取' : '精选手记尚待编写')}
                              </h5>
                              <p>
                                {details[id]?.stories.find(
                                  (story) =>
                                    story.theme ===
                                    ['自然地理', '城市与建筑', '日常生活', '饮食文化'][index],
                                )?.body ||
                                  (p.hasStory
                                    ? '请稍候，或打开城市来源重试。'
                                    : '目前提供地理位置、时区及来源资料。')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="comparison-metrics">
                    <h3>可核验的地理差异</h3>
                    <div>
                      {journey.compare.map((id) => {
                        const p = placeMap.get(id);
                        return p ? (
                          <p key={id}>
                            <strong>{p.name}</strong>
                            <span>{p.timezone}</span>
                            <span>
                              海拔{' '}
                              {typeof p.elevation === 'number'
                                ? `${p.elevation.toLocaleString()} m`
                                : '暂无数据'}
                            </span>
                          </p>
                        ) : null;
                      })}
                    </div>
                    {compareText?.metrics && (
                      <p>
                        纬度相差 {compareText.metrics.latitudeDifference.toFixed(2)}°
                        {compareText.metrics.elevationDifference !== null
                          ? ` · 点位海拔相差 ${compareText.metrics.elevationDifference.toLocaleString()} m`
                          : ''}
                        。{compareText.metrics.climateNote}
                      </p>
                    )}
                    <small>海拔采用 GeoNames 已收录值，缺失值保留为空；资料来源见各地点。</small>
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
                      const p = placeMap.get(id);
                      if (!p) return null;
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
                  <strong>有据可循的故事</strong>
                  {catalog?.curatedTotal ?? '—'} 座精选城市，{seedRoutes.length} 个精选纬度带；另有{' '}
                  {catalog?.total.toLocaleString() ?? '全球'}{' '}
                  个地点资料。每座城市的手记列有来源、范围与核验状态。
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
                纬线是精确的；城市落在真实坐标上。纬度带可选择中心上下各 1°、2°、5° 或 10°
                的范围。城市按经度排序，不代表公路、航线或完整覆盖这条纬线上的文化。
              </p>
              <p>
                所有必要地图、城市插画和故事均放在本地，运行时不依赖第三方网络。图片为原创 SVG
                地景示意。文化资料为静态选编，当地时间通过 IANA 时区计算。
              </p>
              <p className="small-print">
                代码和原创手记采用 MIT 协议，GeoNames 数据采用 CC BY 4.0，字体采用
                OFL。完整来源和素材清单见项目中的 SOURCES.md 与 assets-manifest.json。清除浏览器
                Cookie 会失去当前匿名旅程的入口，请先导出旅程备份。
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
