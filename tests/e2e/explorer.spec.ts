import { test, expect, type Page } from '@playwright/test';
import { places } from '../../src/data/places';

async function ready(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.site-footer')).toContainText('旅程已自动保存');
  await expect(page.getByText('正在展开世界地图…')).toBeHidden();
}

test.beforeEach(async ({ context }) => {
  // The complete core experience must continue with every third-party request blocked.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.abort('internetdisconnected');
  });
});

test('explore, save, compare and publish an immutable snapshot in another browser session', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await ready(page);
  await expect(page.locator('.city-preview h2')).toContainText('杭州');
  await page.getByRole('button', { name: '收藏杭州', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏杭州', exact: true })).toBeEnabled();
  expect((await (await page.request.get('/api/favorites')).json()).favorites).toContain('hangzhou');
  await page.reload();
  await expect(page.getByRole('button', { name: '取消收藏杭州', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: '走进杭州的故事' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.story-grid section')).toHaveCount(4);
  expect(await dialog.locator('.sources a').count()).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: '加入比较', exact: true }).click();
  await page.locator('.city-stop').filter({ hasText: '成都' }).click();
  await expect(page.locator('.city-preview h2')).toContainText('成都');
  await page.getByRole('button', { name: '加入比较', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.compare-cities h3')).toHaveText([/杭州/, /成都/]);
  await expect(page.getByRole('dialog').locator('.comparison-dimension')).toHaveCount(4);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /我的旅程/ }).click();
  await page.getByRole('button', { name: '创建分享链接' }).click();
  const shareUrl = await page.getByLabel('只读分享链接').inputValue();
  const token = new URL(shareUrl).pathname.split('/').at(-1)!;
  const snapshotBefore = (await (await page.request.get(`/api/shared/${token}`)).json()).snapshot;
  expect(snapshotBefore.favorites).toContain('hangzhou');
  expect(snapshotBefore.compare).toEqual(['hangzhou', 'chengdu']);
  await page.keyboard.press('Escape');
  await page.locator('.city-stop').filter({ hasText: '开罗' }).click();
  await expect(page.locator('.site-footer')).toContainText('旅程已自动保存');
  const snapshotAfter = (await (await page.request.get(`/api/shared/${token}`)).json()).snapshot;
  expect(snapshotAfter).toEqual(snapshotBefore);

  const visitor = await browser.newContext();
  try {
    const shared = await visitor.newPage();
    const response = await shared.goto(shareUrl);
    expect(response?.ok()).toBeTruthy();
    await expect(shared.locator('body')).toContainText(snapshotBefore.name);
    await expect(shared.locator('body')).toContainText('杭州');
    const favorites = await visitor.request.get('http://127.0.0.1:3000/api/favorites');
    expect((await favorites.json()).favorites).toEqual([]);
    expect(
      (await (await visitor.request.get(`http://127.0.0.1:3000/api/shared/${token}`)).json())
        .snapshot,
    ).toEqual(snapshotBefore);
  } finally {
    await visitor.close();
  }
  expect(errors).toEqual([]);
});

test('a direct city link, browser history and keyboard navigation synchronize map and preview', async ({
  page,
}) => {
  await ready(page, '/?city=cairo');
  await expect(page.locator('.city-preview h2')).toContainText('开罗');
  await expect(page.getByRole('button', { name: '探索开罗', exact: true })).toBeVisible();
  const previous = await page.locator('.city-preview h2').textContent();
  await page
    .getByRole('group', { name: '可拖动的交互地球，使用左右方向键切换城市', exact: true })
    .focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.city-preview h2')).not.toHaveText(previous!);
  await page.goBack();
  await expect(page.locator('.city-preview h2')).toContainText('开罗');
  await page.goForward();
  await expect(page.locator('.city-preview h2')).not.toHaveText(previous!);
});

test('a comparison URL opens the restored comparison and third-city choice is explicit', async ({
  page,
}) => {
  await ready(page, '/?lat=30&band=2&lng=120.1551&city=hangzhou&compare=hangzhou,cairo');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('.compare-cities h3')).toHaveText([/杭州/, /开罗/]);
  await page.keyboard.press('Escape');
  await page.locator('.city-stop').filter({ hasText: '成都' }).click();
  await page.getByRole('button', { name: '加入比较', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('比较席位已满');
  await page.getByRole('button', { name: '替换开罗', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.compare-cities h3')).toHaveText([/杭州/, /成都/]);
});

test('comparison story navigation finds its own route when the current latitude has no cities', async ({
  page,
}) => {
  await ready(page, '/?lat=0&band=2&lng=0&compare=hangzhou,cairo');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.compare-cities h3')).toHaveText([/杭州/, /开罗/]);
  await dialog.getByRole('button', { name: '杭州的故事与来源', exact: true }).click();
  await expect(dialog.locator('.story-title h2')).toContainText('杭州');
  await dialog.getByRole('button', { name: '向东一站', exact: true }).click();
  await expect(dialog.locator('.story-title h2')).toContainText('休斯敦');
  await expect
    .poll(async () => (await (await page.request.get('/api/journey')).json()).journey.selectedCity)
    .toBe('houston');
  const saved = (await (await page.request.get('/api/journey')).json()).journey;
  expect(saved.latitude).not.toBe(0);
  expect(Math.abs(29.7604 - saved.latitude)).toBeLessThanOrEqual(saved.band);
  await dialog.getByRole('button', { name: '向西一站', exact: true }).click();
  await expect(dialog.locator('.story-title h2')).toContainText('杭州');
  await page.keyboard.press('Escape');
  await expect(page.locator('.city-preview h2')).toContainText('杭州');
  await expect(page.locator('.site-footer')).toContainText('旅程已自动保存');
});

test('a latitude with no stories provides a working return to the default band', async ({
  page,
}) => {
  await ready(page, '/?lat=0&band=2&lng=0');
  await expect(page.locator('.empty-city')).toContainText('这一纬度带还没有收录城市');
  await page
    .locator('.empty-city')
    .getByRole('button', { name: /回到北纬 30°/ })
    .click();
  await expect(page.locator('.city-preview h2')).toContainText('杭州');
  await expect(page.locator('.city-stop')).toHaveCount(8);
});

test('pointer dragging, marker selection, back-face clipping and dialog focus work together', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  const globe = page.getByRole('group', {
    name: '可拖动的交互地球，使用左右方向键切换城市',
    exact: true,
  });
  await expect(globe.locator('[data-city="houston"]')).toHaveCount(0);
  await globe.locator('[data-city="chengdu"]').click();
  await expect(page.locator('.city-preview h2')).toContainText('成都');
  await page.locator('.city-stop').filter({ hasText: '休斯敦' }).click();
  await expect(globe.locator('[data-city="houston"]')).toBeVisible();
  await expect(globe.locator('[data-city="hangzhou"]')).toHaveCount(0);
  await expect(page.locator('.globe-coordinate')).toContainText('108.37° W');
  const previousLongitude = new URL(page.url()).searchParams.get('lng');
  const bounds = (await globe.boundingBox())!;
  const x = bounds.x + bounds.width * 0.4;
  const y = bounds.y + bounds.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 140, y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => new URL(page.url()).searchParams.get('lng')).not.toBe(previousLongitude);
  await expect(globe).not.toHaveClass(/is-dragging/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '地球回到当前城市', exact: true }).click();
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get('lng')))
    .toBeCloseTo(-95.3698, 4);
  await expect(globe.locator('[data-city="houston"]')).toBeVisible();
  const storyTrigger = page.getByRole('button', { name: '走进休斯敦的故事', exact: true });
  await storyTrigger.focus();
  await storyTrigger.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(storyTrigger).toBeFocused();
});

test('all sixteen city previews and their sourced stories fit a 390px viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1100 });
  const overflows: string[] = [];
  for (const place of places) {
    await ready(page, `/?lat=${place.latitude}&band=2&city=${place.id}`);
    await expect(page.locator('.city-preview h2')).toContainText(place.name);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (overflow > 1) overflows.push(`${place.id}: ${overflow}px`);
    await page.getByRole('button', { name: `走进${place.name}的故事`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.story-grid section')).toHaveCount(4);
    expect(await dialog.locator('.sources a').count()).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  expect(overflows).toEqual([]);
});

test('failed favorite writes roll back and a failed journey can be retried', async ({ page }) => {
  await ready(page);
  await page.route('**/api/favorites', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: '临时保存失败' }),
        })
      : route.fallback(),
  );
  await page.getByRole('button', { name: '收藏杭州', exact: true }).click();
  await expect(page.getByRole('button', { name: '收藏杭州', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert').filter({ hasText: '收藏未能保存' })).toContainText(
    '收藏未能保存，已恢复原状态',
  );
  expect((await (await page.request.get('/api/favorites')).json()).favorites).toEqual([]);
  await page.unroute('**/api/favorites');
  await page.getByRole('button', { name: '收藏杭州', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏杭州', exact: true })).toBeEnabled();
  expect((await (await page.request.get('/api/favorites')).json()).favorites).toContain('hangzhou');

  await page.route('**/api/journey', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: '临时保存失败' }),
        })
      : route.fallback(),
  );
  await page.locator('.city-stop').filter({ hasText: '成都' }).click();
  await expect(page.locator('.site-footer')).toContainText('旅程保存失败');
  expect((await (await page.request.get('/api/journey')).json()).journey.selectedCity).toBe(
    'hangzhou',
  );
  await page.unroute('**/api/journey');
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(page.locator('.site-footer')).toContainText('旅程已自动保存');
  expect((await (await page.request.get('/api/journey')).json()).journey.selectedCity).toBe(
    'chengdu',
  );
});

for (const width of [1440, 1024, 390]) {
  test(`the explorer and reading dialog remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await ready(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: '走进杭州的故事' })).toBeVisible();
    await page.getByRole('button', { name: '走进杭州的故事' }).click();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole('button', { name: '关闭面板', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
}
