import type { PlaceProfile, PlaceSummary, RelatedPlace } from './place-types';

const EARTH_RADIUS_KM = 6371.0088;
const RADIANS = Math.PI / 180;
const compass = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

/**
 * A compact 3D k-d tree. Chord distance is monotonic with great-circle distance,
 * so the nearest neighbours are exact even across the date line or near a pole.
 * The index retains summaries, never a materialised profile for every city.
 */
export function createPlaceIndex(places: readonly PlaceSummary[]) {
  const order = Uint32Array.from({ length: places.length }, (_, index) => index);
  const xyz = new Float64Array(places.length * 3);
  for (let index = 0; index < places.length; index++) {
    const latitude = places[index].latitude * RADIANS;
    const longitude = places[index].longitude * RADIANS;
    xyz[index * 3] = Math.cos(latitude) * Math.cos(longitude);
    xyz[index * 3 + 1] = Math.cos(latitude) * Math.sin(longitude);
    xyz[index * 3 + 2] = Math.sin(latitude);
  }
  const value = (position: number, axis: number) => xyz[order[position] * 3 + axis];
  function select(start: number, end: number, middle: number, axis: number) {
    let left = start;
    let right = end - 1;
    while (left < right) {
      const pivot = value((left + right) >>> 1, axis);
      let low = left;
      let high = right;
      while (low <= high) {
        while (value(low, axis) < pivot) low++;
        while (value(high, axis) > pivot) high--;
        if (low <= high) {
          [order[low], order[high]] = [order[high], order[low]];
          low++;
          high--;
        }
      }
      if (middle <= high) right = high;
      else if (middle >= low) left = low;
      else return;
    }
  }
  function build(start: number, end: number, depth: number) {
    if (start >= end) return;
    const middle = (start + end) >>> 1;
    select(start, end, middle, depth % 3);
    build(start, middle, depth + 1);
    build(middle + 1, end, depth + 1);
  }
  build(0, places.length, 0);

  return function nearest(
    origin: Pick<PlaceSummary, 'id' | 'latitude' | 'longitude'>,
    count = 3,
  ): RelatedPlace[] {
    const lat = origin.latitude * RADIANS;
    const lng = origin.longitude * RADIANS;
    const point = [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
    const best: { index: number; squared: number }[] = [];
    function visit(start: number, end: number, depth: number) {
      if (start >= end) return;
      const middle = (start + end) >>> 1;
      const index = order[middle];
      const axis = depth % 3;
      const difference = point[axis] - xyz[index * 3 + axis];
      const near = difference < 0 ? [start, middle] : [middle + 1, end];
      const far = difference < 0 ? [middle + 1, end] : [start, middle];
      visit(near[0], near[1], depth + 1);
      if (places[index].id !== origin.id) {
        const squared =
          (point[0] - xyz[index * 3]) ** 2 +
          (point[1] - xyz[index * 3 + 1]) ** 2 +
          (point[2] - xyz[index * 3 + 2]) ** 2;
        if (best.length < count || squared < best[best.length - 1].squared) {
          best.push({ index, squared });
          best.sort(
            (a, b) => a.squared - b.squared || places[a.index].id.localeCompare(places[b.index].id),
          );
          if (best.length > count) best.pop();
        }
      }
      if (best.length < count || difference * difference <= best[best.length - 1].squared)
        visit(far[0], far[1], depth + 1);
    }
    if (count <= 0) return [];
    visit(0, places.length, 0);
    return best.map(({ index, squared }) => {
      const place = places[index];
      const targetLat = place.latitude * RADIANS;
      const deltaLng = (place.longitude - origin.longitude) * RADIANS;
      const bearing =
        (Math.atan2(
          Math.sin(deltaLng) * Math.cos(targetLat),
          Math.cos(lat) * Math.sin(targetLat) -
            Math.sin(lat) * Math.cos(targetLat) * Math.cos(deltaLng),
        ) /
          RADIANS +
          360) %
        360;
      return {
        id: place.id,
        name: place.name,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        distanceKm:
          Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(squared) / 2)) * 10) /
          10,
        direction: squared < 1e-20 ? '同一近似坐标' : compass[Math.round(bearing / 45) % 8],
      };
    });
  };
}

export function geographicProfile(
  place: PlaceSummary,
  nearby: RelatedPlace[],
  related: RelatedPlace[],
  regionLabel?: string,
): PlaceProfile {
  const latitude = Math.abs(place.latitude);
  const latLabel = place.latitude === 0 ? '赤道' : place.latitude < 0 ? '南纬' : '北纬';
  const lngLabel = place.longitude === 0 ? '本初子午线' : place.longitude < 0 ? '西经' : '东经';
  const hemisphere = place.latitude === 0 ? '赤道上' : place.latitude < 0 ? '南半球' : '北半球';
  const longitudeHemisphere =
    place.longitude === 0
      ? '本初子午线上'
      : Math.abs(place.longitude) === 180
        ? '180°经线上'
        : place.longitude < 0
          ? '本初子午线以西'
          : '本初子午线以东';
  const belt =
    latitude < 23.44 ? '两条回归线之间' : latitude < 66.56 ? '回归线与极圈之间' : '极圈以内';
  const admin = regionLabel ?? place.admin;
  return {
    regionText: `${place.country}${admin ? ` · ${admin}` : ''}。${admin ? '这里显示 GeoNames 的一级行政区名称；行政区与都市范围并不等同。' : '上游未提供可用的一级行政区名称。'}`,
    coordinateText: `${latLabel} ${latitude.toFixed(4)}°，${lngLabel} ${Math.abs(place.longitude).toFixed(4)}°。这是聚落的近似中心点，不是城市边界或每一处街区的坐标。`,
    latitudeText: `位于${hemisphere}、${longitudeHemisphere}；按约23.44°的回归线与66.56°的极圈作几何分区，这个坐标处在${belt}。纬度相近不代表气候、海拔或生活方式相同。`,
    timezoneText: `${place.timezone} 是该记录采用的 IANA 时区标识。它指向当地民用时间规则，实际 UTC 偏移与夏令时须按日期换算，不能直接用经度代替。`,
    elevationText:
      place.elevation === null || place.elevation === undefined
        ? 'GeoNames 未提供此点位的可用海拔，未以地形模型或附近地点的高度补值。'
        : `GeoNames 记录的点位海拔约 ${place.elevation.toLocaleString('zh-CN')} 米${place.elevation < 0 ? '（低于平均海平面）' : '（相对平均海平面）'}。这是单点资料，不是整个城区的平均高度。`,
    aliases: [...new Set([place.originalName, ...(place.aliases ?? [])])]
      .filter((name) => name && name !== place.name)
      .slice(0, 6),
    nearby,
    related,
  };
}
