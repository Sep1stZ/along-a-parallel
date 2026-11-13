'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { geoPath, type GeoProjection } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import {
  GLOBE_HEIGHT,
  GLOBE_RADIUS,
  GLOBE_WIDTH,
  GRATICULE,
  type latitudeGeometry,
} from './globe-geometry';
import styles from './Globe.module.css';

/** Canvas owns the expensive land/graticule paint. Interactive city markers stay SVG. */
export default memo(function GlobeBasemap({
  world,
  projection,
  geometry,
}: {
  world: FeatureCollection | null;
  projection: GeoProjection;
  geometry: ReturnType<typeof latitudeGeometry>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [resolution, setResolution] = useState(1);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      // The canvas and SVG both use xMidYMid/contain, including max-height layouts.
      const scale = Math.min(bounds.width / GLOBE_WIDTH, bounds.height / GLOBE_HEIGHT);
      setResolution(Math.max(0.25, scale * Math.min(window.devicePixelRatio || 1, 2)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);
  useLayoutEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.setTransform(resolution, 0, 0, resolution, 0, 0);
    context.clearRect(0, 0, GLOBE_WIDTH, GLOBE_HEIGHT);
    const path = geoPath(projection, context);
    const sphere = () => {
      context.beginPath();
      context.arc(320, 286, GLOBE_RADIUS, 0, Math.PI * 2);
    };
    const sea = context.createRadialGradient(252.24, 179.52, 0, 252.24, 179.52, 377.52);
    sea.addColorStop(0, '#2b6470');
    sea.addColorStop(0.68, '#1e4b57');
    sea.addColorStop(1, '#113440');
    sphere();
    context.fillStyle = sea;
    context.fill();
    if (world) {
      context.beginPath();
      path(world);
      context.fillStyle = '#b7bea3';
      context.fill();
      context.strokeStyle = '#8f9c8c';
      context.lineWidth = 0.45;
      context.stroke();
    }
    context.beginPath();
    path(GRATICULE);
    context.strokeStyle = 'rgba(223, 223, 197, 0.15)';
    context.lineWidth = 0.65;
    context.stroke();
    context.beginPath();
    path(geometry.upper);
    path(geometry.lower);
    context.fillStyle = 'rgba(227, 172, 116, 0.22)';
    context.fill('evenodd');
    context.beginPath();
    path(geometry.parallel);
    context.strokeStyle = '#e8ad79';
    context.lineWidth = 2;
    context.stroke();
    const shade = context.createRadialGradient(223.2, 174.68, 0, 223.2, 174.68, 363);
    shade.addColorStop(0.45, 'rgba(10, 36, 46, 0)');
    shade.addColorStop(1, 'rgba(10, 36, 46, 0.37)');
    sphere();
    context.fillStyle = shade;
    context.fill();
  }, [world, projection, geometry, resolution]);
  return (
    <canvas
      ref={canvas}
      className={styles.basemap}
      width={Math.round(GLOBE_WIDTH * resolution)}
      height={Math.round(GLOBE_HEIGHT * resolution)}
      aria-hidden="true"
    />
  );
});
