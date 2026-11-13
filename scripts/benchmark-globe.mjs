import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
const phase = process.argv[2] || 'current';
if (!/^[a-z0-9-]{1,64}$/.test(phase)) throw new Error('Use a short lowercase phase name.');
const base = process.argv[3] || 'http://127.0.0.1:3100';
const out = process.argv[4] || join(process.cwd(), 'work', `globe-perf-${phase}.json`);
fs.mkdirSync(dirname(out), { recursive: true });
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(2);
};
const summarize = (values) => ({
  count: values.length,
  medianMs: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  maxMs: percentile(values, 1),
});
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
  });
  const results = [];
  for (const cpuRate of [1, 4]) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/?lat=30&band=2&city=hangzhou');
      await page.locator('.site-footer').getByText('旅程已自动保存', { exact: true }).waitFor();
      await page.locator('.map-loading').waitFor({ state: 'hidden' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1100);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      const bounds = await page.locator('svg.globe').boundingBox();
      const xCenter = bounds.x + bounds.width * 0.5;
      const yCenter = bounds.y + bounds.height * 0.72;
      const xRadius = bounds.width * 0.2;
      await page.mouse.move(xCenter, yCenter);
      await page.mouse.down();
      await page.evaluate(() => {
        const stats = {
          frames: [],
          longTasks: [],
          latencies: [],
          pointerCount: 0,
          coordinateUpdates: 0,
          pathMutations: 0,
          canvasDraws: 0,
          transforms: 0,
          start: performance.now(),
          lastInput: 0,
          firstInput: 0,
          lastFrame: 0,
        };
        const clearRect = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
          if (this.canvas.closest('.globe-wrap')) stats.canvasDraws++;
          return clearRect.apply(this, args);
        };
        const coordinate = document.querySelector('.globe-coordinate');
        let stopped = false;
        const frame = (time) => {
          if (stopped) return;
          if (stats.lastFrame) stats.frames.push(time - stats.lastFrame);
          stats.lastFrame = time;
          requestAnimationFrame(frame);
        };
        const pointer = () => {
          stats.pointerCount++;
          stats.lastInput = performance.now();
          if (!stats.firstInput) stats.firstInput = stats.lastInput;
        };
        document
          .querySelector('svg.globe')
          .addEventListener('pointermove', pointer, { capture: true });
        const observer = new MutationObserver(() => {
          stats.coordinateUpdates++;
          if (stats.lastInput) stats.latencies.push(performance.now() - stats.lastInput);
        });
        observer.observe(coordinate, { childList: true, characterData: true, subtree: true });
        const geometry = new MutationObserver((records) => {
          for (const r of records) {
            if (r.attributeName === 'd') stats.pathMutations++;
            if (r.attributeName === 'transform') stats.transforms++;
          }
        });
        geometry.observe(document.querySelector('svg.globe'), {
          attributes: true,
          attributeFilter: ['d', 'transform'],
          subtree: true,
        });
        const tasks = new PerformanceObserver((list) =>
          stats.longTasks.push(...list.getEntries().map((e) => e.duration)),
        );
        tasks.observe({ entryTypes: ['longtask'] });
        requestAnimationFrame(frame);
        window.__stopGlobePerf = () => {
          stopped = true;
          observer.disconnect();
          geometry.disconnect();
          tasks.disconnect();
          CanvasRenderingContext2D.prototype.clearRect = clearRect;
          document
            .querySelector('svg.globe')
            .removeEventListener('pointermove', pointer, { capture: true });
          return {
            ...stats,
            elapsed: performance.now() - stats.start,
            inputDuration: stats.lastInput - stats.firstInput,
          };
        };
      });
      const inputDuration = 4000;
      const rate = 120;
      const scheduled = [];
      const wallStart = performance.now();
      await new Promise((resolve) => {
        const timer = setInterval(() => {
          const elapsed = performance.now() - wallStart;
          if (elapsed > inputDuration) {
            clearInterval(timer);
            resolve();
            return;
          }
          const theta = (elapsed / inputDuration) * Math.PI * 4;
          scheduled.push(
            cdp.send('Input.dispatchMouseEvent', {
              type: 'mouseMoved',
              x: xCenter + xRadius * Math.sin(theta),
              y: yCenter,
              button: 'left',
              buttons: 1,
              pointerType: 'mouse',
            }),
          );
        }, 1000 / rate);
      });
      await Promise.all(scheduled);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const stats = await page.evaluate(() => window.__stopGlobePerf());
      await page.mouse.up();
      const result = {
        cpuRate,
        run,
        viewport: '1440x1100',
        requestedInputHz: rate,
        scheduledInputs: scheduled.length,
        elapsedMs: +stats.elapsed.toFixed(1),
        actualInputDurationMs: +stats.inputDuration.toFixed(1),
        deliveredPointerEvents: stats.pointerCount,
        coordinateUpdates: stats.coordinateUpdates,
        frames: summarize(stats.frames),
        framesOver25ms: stats.frames.filter((n) => n > 25).length,
        framesOver50ms: stats.frames.filter((n) => n > 50).length,
        longTasks: summarize(stats.longTasks),
        inputToCoordinateUpdate: summarize(stats.latencies),
        svgPathMutations: stats.pathMutations,
        canvasDraws: stats.canvasDraws,
        markerTransformMutations: stats.transforms,
        canvasCount: await page.locator('.globe-wrap canvas').count(),
        errors,
      };
      results.push(result);
      console.log(JSON.stringify(result));
      await context.close();
    }
  }
  await browser.close();
  const report = {
    phase,
    measuredAt: new Date().toISOString(),
    environment:
      'Windows, installed Chrome headless, local production Next server; fixed 4s trusted CDP mouse drag at requested 120Hz; performance observers constant across versions. CPU throttling emulates a slower main thread, not a specific phone.',
    limitations:
      'rAF intervals measure main-thread frame opportunities, not physical display FPS. Input-to-coordinate-update measures DOM commit latency, not photon latency. Browser may coalesce input; delivery counts and actual duration are reported.',
    results,
  };
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(out);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
