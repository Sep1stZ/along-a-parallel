import { geoCircle, geoGraticule10 } from 'd3-geo';
import type { FeatureCollection, Geometry, Position } from 'geojson';

export const GLOBE_WIDTH = 640;
export const GLOBE_HEIGHT = 574;
export const GLOBE_RADIUS = 242;
export const GRATICULE = geoGraticule10();

export function latitudeGeometry(latitude: number, band: number) {
  return {
    parallel: {
      type: 'LineString' as const,
      coordinates: Array.from({ length: 361 }, (_, i) => [-180 + i, latitude]),
    },
    upper: geoCircle()
      .center([0, 90])
      .radius(90 - Math.min(89.999, latitude + band))
      .precision(1)(),
    lower: geoCircle()
      .center([0, 90])
      .radius(90 - Math.max(-89.999, latitude - band))
      .precision(1)(),
  };
}

type Vector = [number, number, number];
const radians = Math.PI / 180;
const vector = ([longitude, latitude]: Position): Vector => {
  const cosLatitude = Math.cos(latitude * radians);
  return [
    Math.cos(longitude * radians) * cosLatitude,
    Math.sin(longitude * radians) * cosLatitude,
    Math.sin(latitude * radians),
  ];
};
function segmentDistanceSquared(point: Vector, start: Vector, end: Vector) {
  const delta = end.map((value, axis) => value - start[axis]);
  const length = delta.reduce((sum, value) => sum + value * value, 0);
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          point.reduce((sum, value, axis) => sum + (value - start[axis]) * delta[axis], 0) / length,
        ),
      )
    : 0;
  return point.reduce((sum, value, axis) => {
    const distance = value - start[axis] - delta[axis] * t;
    return sum + distance * distance;
  }, 0);
}

/** A motion-only coastline, simplified once in 3D to handle the date line/poles.
 * 0.18 degrees is under one projected logical pixel at this globe's radius.
 * The original Natural Earth geometry is restored whenever motion stops. */
export function motionWorld(world: FeatureCollection): FeatureCollection {
  const toleranceSquared = (0.18 * radians) ** 2;
  const ring = (positions: Position[]): Position[] => {
    if (positions.length <= 5) return positions;
    const vectors = positions.map(vector);
    const keep = new Set([0, positions.length - 1]);
    const pending = [[0, positions.length - 1]];
    while (pending.length) {
      const [first, last] = pending.pop()!;
      let furthest = -1;
      let distance = toleranceSquared;
      for (let i = first + 1; i < last; i++) {
        const next = segmentDistanceSquared(vectors[i], vectors[first], vectors[last]);
        if (next > distance) {
          furthest = i;
          distance = next;
        }
      }
      if (furthest !== -1) {
        keep.add(furthest);
        pending.push([first, furthest], [furthest, last]);
      }
    }
    const reduced = positions.filter((_, index) => keep.has(index));
    return reduced.length >= 4 ? reduced : positions;
  };
  const geometry = (value: Geometry): Geometry => {
    if (value.type === 'Polygon') return { ...value, coordinates: value.coordinates.map(ring) };
    if (value.type === 'MultiPolygon')
      return { ...value, coordinates: value.coordinates.map((polygon) => polygon.map(ring)) };
    return value;
  };
  return {
    ...world,
    features: world.features.map((feature) => ({
      ...feature,
      geometry: feature.geometry ? geometry(feature.geometry) : feature.geometry,
    })),
  };
}
