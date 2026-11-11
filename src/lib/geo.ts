export const normalizeLongitude = (value: number) =>
  value >= -180 && value < 180
    ? value
    : Number((((((value + 180) % 360) + 360) % 360) - 180).toFixed(10));
export const shortestAngle = (from: number, to: number) => from + normalizeLongitude(to - from);
export const inBand = (latitude: number, center: number, band: number) =>
  Math.abs(latitude - center) <= band + 1e-9;
export const latitudeLabel = (value: number) =>
  value === 0 ? '赤道 0°' : `${value < 0 ? '南纬' : '北纬'} ${Math.abs(value)}°`;
export const coordinate = (value: number, lat = true) =>
  `${Math.abs(value).toFixed(2)}° ${lat ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'}`;
export type ExploreState = {
  latitude: number;
  band: number;
  longitude: number;
  selectedCity: string | null;
  compare: string[];
};
export function parseExplore(search: string, knownIds?: string[]): ExploreState | null {
  const p = new URLSearchParams(search);
  if (!p.size) return null;
  const number = (name: string, fallback: number, min: number, max: number) => {
    if (!p.has(name)) return fallback;
    const raw = p.get(name)!;
    const value = raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < min || value > max) throw new Error('invalid');
    return value;
  };
  try {
    const latitude = number('lat', 30, -90, 90);
    const band = number('band', 2, 0.1, 10);
    const longitude = number('lng', 120.1551, -180, 180);
    const selectedCity = p.get('city');
    const compare = [...new Set(p.get('compare')?.split(',').filter(Boolean) ?? [])];
    if (
      (selectedCity &&
        !(knownIds ? knownIds.includes(selectedCity) : /^[a-z0-9-]{1,60}$/.test(selectedCity))) ||
      compare.length > 2 ||
      compare.some((id) => !(knownIds ? knownIds.includes(id) : /^[a-z0-9-]{1,60}$/.test(id)))
    )
      return null;
    return { latitude, band, longitude, selectedCity, compare };
  } catch {
    return null;
  }
}
export function exploreUrl(state: ExploreState) {
  const p = new URLSearchParams({
    lat: String(state.latitude),
    band: String(state.band),
    lng: String(normalizeLongitude(state.longitude)),
  });
  if (state.selectedCity) p.set('city', state.selectedCity);
  if (state.compare.length) p.set('compare', state.compare.join(','));
  return `/?${p}`;
}
