'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoDistance, geoOrthographic } from 'd3-geo';
import { Compass, Move, RotateCcw } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import type { PlaceSummary } from '@/lib/place-types';
import { coordinate, normalizeLongitude, shortestAngle } from '@/lib/geo';
import GlobeBasemap from './GlobeBasemap';
import { latitudeGeometry, motionWorld } from './globe-geometry';
import styles from './Globe.module.css';

export default function Globe({
  latitude,
  band,
  places,
  selected,
  longitude,
  onSelect,
  onStep,
  onLongitude,
}: {
  latitude: number;
  band: number;
  places: PlaceSummary[];
  selected: string | null;
  longitude: number;
  onSelect: (id: string) => void;
  onStep: (direction: number) => void;
  onLongitude: (value: number) => void;
}) {
  const [world, setWorld] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [rotation, setRotation] = useState<[number, number]>([105, 20]);
  const rotationRef = useRef(rotation);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    lon: number;
    lat: number;
    moved: boolean;
  } | null>(null);
  const animate = useRef(0);
  const dragFrame = useRef(0);
  const localLongitude = useRef<{ longitude: number; latitude: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [ocean, setOcean] = useState(false);
  const mapRequest = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    mapRequest.current?.abort();
    const controller = new AbortController();
    mapRequest.current = controller;
    fetch('/maps/world.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setWorld(data);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
  }, []);
  useEffect(() => {
    load();
    const element = svg.current;
    return () => {
      mapRequest.current?.abort();
      cancelAnimationFrame(animate.current);
      cancelAnimationFrame(dragFrame.current);
      const pointer = drag.current?.id;
      drag.current = null;
      if (pointer !== undefined && element?.hasPointerCapture(pointer))
        element.releasePointerCapture(pointer);
    };
  }, [load]);
  const flushDrag = useCallback(() => {
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    setRotation(rotationRef.current);
  }, []);
  const moveTo = useCallback((targetLon: number, targetLat: number) => {
    cancelAnimationFrame(animate.current);
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    const from = rotationRef.current;
    const to = [shortestAngle(from[0], targetLon), targetLat];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimating(!reduced);
    const start = performance.now();
    const frame = (time: number) => {
      const t = reduced ? 1 : Math.min(1, (time - start) / 850);
      const ease = 1 - Math.pow(1 - t, 3);
      const next: [number, number] = [
        from[0] + (to[0] - from[0]) * ease,
        from[1] + (to[1] - from[1]) * ease,
      ];
      rotationRef.current = next;
      setRotation(next);
      if (t < 1) animate.current = requestAnimationFrame(frame);
      else {
        animate.current = 0;
        setAnimating(false);
      }
    };
    animate.current = requestAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const local = localLongitude.current;
    localLongitude.current = null;
    // A drag writes its longitude back to the journey. Acknowledge that echo
    // without resetting its vertical rotation or starting a second animation.
    if (
      local &&
      local.latitude === latitude &&
      Math.abs(normalizeLongitude(local.longitude - longitude)) < 1e-9
    )
      return;
    moveTo(longitude - 13, Math.max(-65, Math.min(65, latitude * 0.62)));
    return () => cancelAnimationFrame(animate.current);
  }, [longitude, latitude, moveTo]);
  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([320, 286])
        .scale(242)
        .rotate([-rotation[0], -rotation[1], -8])
        .clipAngle(90)
        .precision(0.5),
    [rotation],
  );
  const geometry = useMemo(() => latitudeGeometry(latitude, band), [latitude, band]);
  const motionMap = useMemo(() => (world ? motionWorld(world) : null), [world]);
  const pointVisible = (lon: number, lat: number) =>
    geoDistance([rotation[0], rotation[1]], [lon, lat]) < Math.PI / 2 - 0.035;
  const grouped = new Map<string, { place: PlaceSummary; xy: [number, number]; count: number }>();
  const visible = places
    .filter((p) => pointVisible(p.longitude, p.latitude))
    .sort(
      (a, b) =>
        Number(b.id === selected) - Number(a.id === selected) ||
        Number(b.hasStory) - Number(a.hasStory),
    );
  for (const place of visible) {
    const xy = projection([place.longitude, place.latitude]);
    if (!xy) continue;
    const key = `${Math.floor(xy[0] / 29)},${Math.floor(xy[1] / 29)}`;
    const previous = grouped.get(key);
    if (previous) previous.count++;
    else grouped.set(key, { place, xy, count: 1 });
  }
  const labels: { x: number; y: number; width: number }[] = [];
  const markers = [...grouped.values()].map((marker) => {
    const active = marker.place.id === selected;
    const width = Math.min(130, marker.place.name.length * 11 + 15);
    const label =
      active ||
      (labels.length < 10 &&
        !labels.some(
          (other) =>
            Math.abs(other.y - marker.xy[1]) < 24 &&
            Math.abs(other.x - marker.xy[0]) < (other.width + width) / 2,
        ));
    if (label) labels.push({ x: marker.xy[0], y: marker.xy[1], width });
    return { ...marker, label };
  });
  return (
    <div className="globe-wrap">
      <div className="map-corner">
        <Compass size={17} />
        <span>一颗地球，无数种日常</span>
      </div>
      <div className="north-indicator">
        N<span>↑</span>
      </div>
      <div className={styles.stage}>
        <GlobeBasemap
          world={dragging || animating ? motionMap : world}
          projection={projection}
          geometry={geometry}
        />
        <svg
          ref={svg}
          className={`globe ${styles.overlay} ${dragging ? 'is-dragging' : ''}`}
          viewBox="0 0 640 574"
          role="group"
          aria-label="可拖动的交互地球，使用左右方向键切换城市"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              onStep(e.key === 'ArrowRight' ? 1 : -1);
            }
          }}
          onPointerDown={(e) => {
            if (
              e.button !== 0 ||
              !e.isPrimary ||
              drag.current ||
              (e.target as Element).closest('[data-city]')
            )
              return;
            cancelAnimationFrame(animate.current);
            setAnimating(false);
            drag.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              lon: rotationRef.current[0],
              lat: rotationRef.current[1],
              moved: false,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) {
              if (!d.moved) setDragging(true);
              d.moved = true;
            }
            if (d.moved) {
              const next: [number, number] = [
                d.lon - dx * 0.32,
                Math.max(-80, Math.min(80, d.lat + dy * 0.25)),
              ];
              rotationRef.current = next;
              // Browser pointer events may arrive faster than display refresh.
              // Only the newest position is committed, at most once per frame.
              if (!dragFrame.current)
                dragFrame.current = requestAnimationFrame(() => {
                  dragFrame.current = 0;
                  setRotation(rotationRef.current);
                });
            }
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            flushDrag();
            if (d.moved) {
              const nextLongitude = normalizeLongitude(rotationRef.current[0] + 13);
              localLongitude.current = { longitude: nextLongitude, latitude };
              onLongitude(nextLongitude);
              setOcean(
                !places.some(
                  (p) => Math.abs(normalizeLongitude(p.longitude - rotationRef.current[0])) < 22,
                ),
              );
            }
            drag.current = null;
            setDragging(false);
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => {
            if (drag.current?.id !== e.pointerId) return;
            flushDrag();
            drag.current = null;
            setDragging(false);
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onLostPointerCapture={(e) => {
            if (drag.current?.id !== e.pointerId) return;
            flushDrag();
            drag.current = null;
            setDragging(false);
          }}
        >
          <defs>
            <filter id="shadow">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>
          <ellipse
            cx="320"
            cy="543"
            rx="148"
            ry="9"
            fill="#233c3b"
            opacity=".13"
            filter="url(#shadow)"
          />
          <circle
            cx="320"
            cy="286"
            r="259"
            fill="none"
            stroke="#a9b0a1"
            strokeWidth=".7"
            strokeDasharray="1 6"
          />
          {markers.map(({ place: p, xy, count, label }) => {
            const active = p.id === selected;
            return (
              <g
                key={p.id}
                data-city={p.id}
                transform={`translate(${xy[0].toFixed(3)},${xy[1].toFixed(3)})`}
                className="map-marker"
                role="button"
                aria-label={`探索${p.name}${count > 1 ? `，附近聚合 ${count} 个地点` : ''}`}
                tabIndex={0}
                onClick={() => {
                  setOcean(false);
                  onSelect(p.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p.id);
                  }
                }}
              >
                <title>
                  {p.name}
                  {count > 1 ? ` · 当前页附近 ${count} 个地点，可用列表逐一查看` : ''}
                </title>
                <circle r="17" fill="transparent" />
                {active && (
                  <circle
                    r="12"
                    fill="#e8ad79"
                    fillOpacity=".23"
                    stroke="#f0bb8a"
                    strokeOpacity=".55"
                  />
                )}
                <circle
                  r={count > 1 ? 9 : active ? 5 : 3.5}
                  fill={active ? '#f1c497' : '#f4efe5'}
                  stroke="#294a48"
                  strokeWidth="1.5"
                />
                {count > 1 && (
                  <text y="3" textAnchor="middle" fill="#183c3b" fontSize="8" fontWeight="600">
                    {count}
                  </text>
                )}
                {label && (
                  <text
                    x={active ? 15 : 12}
                    y={active ? -10 : -9}
                    fill="#fff8e9"
                    fontSize={active ? 16 : 11}
                    fontWeight={active ? 600 : 400}
                    paintOrder="stroke"
                    stroke="#254746"
                    strokeWidth="3"
                  >
                    {p.name}
                  </text>
                )}
                {active && (
                  <text x="15" y="7" fill="#e0d3b8" fontSize="8" letterSpacing="1.5">
                    {p.originalName.toUpperCase().slice(0, 30)}
                  </text>
                )}
              </g>
            );
          })}
          <text x="578" y="289" fill="#b3724f" fontFamily="Georgia, serif" fontSize="15">
            {Math.abs(latitude)}°{latitude < 0 ? 'S' : 'N'}
          </text>
        </svg>
      </div>
      {failed && (
        <div className="map-error">
          地图加载失败 <button onClick={load}>重试</button>
        </div>
      )}
      {!world && !failed && <div className="map-loading">正在展开世界地图…</div>}
      <div className="map-bottom">
        <span>
          <Move size={13} /> 拖动地球，沿纬线漫游
        </span>
        <button
          aria-label="地球回到当前城市"
          onClick={() => {
            const city = places.find((p) => p.id === selected);
            const lon = city?.longitude ?? longitude;
            moveTo(lon - 13, latitude * 0.62);
            onLongitude(lon);
            setOcean(false);
          }}
        >
          <RotateCcw size={13} /> 复位视角
        </button>
      </div>
      {ocean && (
        <p className="ocean-note">当前页在这一视角没有地点标记，继续转动地球，或选择下一站。</p>
      )}
      <div className="globe-coordinate">
        {coordinate(normalizeLongitude(rotation[0]), false)}
        <span>ORTHOGRAPHIC PROJECTION</span>
      </div>
    </div>
  );
}
