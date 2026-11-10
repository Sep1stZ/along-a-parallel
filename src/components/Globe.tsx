'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoCircle, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { Compass, Move, RotateCcw } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import type { Place } from '@/data/places';
import { coordinate, normalizeLongitude, shortestAngle } from '@/lib/geo';

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
  places: Place[];
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
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    lon: number;
    lat: number;
    moved: boolean;
  } | null>(null);
  const animate = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [ocean, setOcean] = useState(false);
  const load = useCallback(() => {
    fetch('/maps/world.json')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setWorld(data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const moveTo = useCallback((targetLon: number, targetLat: number) => {
    cancelAnimationFrame(animate.current);
    const from = rotationRef.current;
    const to = [shortestAngle(from[0], targetLon), targetLat];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    };
    animate.current = requestAnimationFrame(frame);
  }, []);
  useEffect(() => {
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
  const path = geoPath(projection);
  const parallel = {
    type: 'LineString' as const,
    coordinates: Array.from({ length: 721 }, (_, i) => [-180 + i * 0.5, latitude]),
  };
  const cap1 = geoCircle()
    .center([0, 90])
    .radius(90 - Math.min(89.999, latitude + band))
    .precision(1)();
  const cap2 = geoCircle()
    .center([0, 90])
    .radius(90 - Math.max(-89.999, latitude - band))
    .precision(1)();
  const pointVisible = (lon: number, lat: number) =>
    geoDistance([rotation[0], rotation[1]], [lon, lat]) < Math.PI / 2 - 0.035;
  return (
    <div className="globe-wrap">
      <div className="map-corner">
        <Compass size={17} />
        <span>一颗地球，无数种日常</span>
      </div>
      <div className="north-indicator">
        N<span>↑</span>
      </div>
      <svg
        className={`globe ${dragging ? 'is-dragging' : ''}`}
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
          if (e.button !== 0 || (e.target as Element).closest('[data-city]')) return;
          cancelAnimationFrame(animate.current);
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
            d.moved = true;
            setDragging(true);
          }
          if (d.moved) {
            const next: [number, number] = [
              d.lon - dx * 0.32,
              Math.max(-80, Math.min(80, d.lat + dy * 0.25)),
            ];
            rotationRef.current = next;
            setRotation(next);
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d) return;
          if (d.moved) {
            onLongitude(normalizeLongitude(rotationRef.current[0] + 13));
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
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <defs>
          <radialGradient id="sea" cx="36%" cy="28%" r="78%">
            <stop stopColor="#2b6470" />
            <stop offset=".68" stopColor="#1e4b57" />
            <stop offset="1" stopColor="#113440" />
          </radialGradient>
          <radialGradient id="shade" cx="30%" cy="27%" r="75%">
            <stop offset=".45" stopColor="#0a242e" stopOpacity="0" />
            <stop offset="1" stopColor="#0a242e" stopOpacity=".37" />
          </radialGradient>
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
        <path d={path({ type: 'Sphere' }) || ''} fill="url(#sea)" />
        {world && <path d={path(world) || ''} fill="#b7bea3" stroke="#8f9c8c" strokeWidth=".45" />}
        <path
          d={path(geoGraticule10()) || ''}
          fill="none"
          stroke="#dfdfc5"
          strokeOpacity=".15"
          strokeWidth=".65"
        />
        <path
          d={`${path(cap1) || ''}${path(cap2) || ''}`}
          fill="#e3ac74"
          fillOpacity=".22"
          fillRule="evenodd"
        />
        <path d={path(parallel) || ''} fill="none" stroke="#e8ad79" strokeWidth="2" />
        <path d={path({ type: 'Sphere' }) || ''} fill="url(#shade)" pointerEvents="none" />
        {places
          .filter((p) => pointVisible(p.longitude, p.latitude))
          .map((p) => {
            const xy = projection([p.longitude, p.latitude]);
            if (!xy) return null;
            const active = p.id === selected;
            return (
              <g
                key={p.id}
                data-city={p.id}
                transform={`translate(${xy[0].toFixed(3)},${xy[1].toFixed(3)})`}
                className="map-marker"
                role="button"
                aria-label={`探索${p.name}`}
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
                  r={active ? 5 : 3.5}
                  fill={active ? '#f1c497' : '#f4efe5'}
                  stroke="#294a48"
                  strokeWidth="1.5"
                />
                <text
                  x={active ? 15 : 10}
                  y={active ? -10 : -8}
                  fill="#fff8e9"
                  fontSize={active ? 16 : 11}
                  fontWeight={active ? 600 : 400}
                  paintOrder="stroke"
                  stroke="#254746"
                  strokeWidth="3"
                >
                  {p.name}
                </text>
                {active && (
                  <text x="15" y="7" fill="#e0d3b8" fontSize="8" letterSpacing="1.5">
                    {p.originalName.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        <text x="578" y="289" fill="#b3724f" fontFamily="Georgia, serif" fontSize="15">
          {Math.abs(latitude)}°{latitude < 0 ? 'S' : 'N'}
        </text>
      </svg>
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
      {ocean && <p className="ocean-note">这一段还没有收录故事，继续转动地球，或选择下一站。</p>}
      <div className="globe-coordinate">
        {coordinate(normalizeLongitude(rotation[0]), false)}
        <span>ORTHOGRAPHIC PROJECTION</span>
      </div>
    </div>
  );
}
