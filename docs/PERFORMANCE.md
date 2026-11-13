# 地球拖动性能记录

实测日期：2026-11-13。基线为 V2 已发布代码 `2f5735ed5ccc87ec18e4cc31e5b77cbf36ecce56`，对照为本轮 Canvas 底图与 SVG 交互标记实现。

## 改动与原因

原实现每次 pointermove 都触发 React 更新，重建经纬网、纬线及纬度带，再把整份海岸线投影成 SVG 长路径字符串。输入频率超过显示刷新时，重复计算会占满主线程。

新版将海岸线、经纬网和纬带画在 Canvas 上，城市标记仍使用可访问的 SVG 按钮。拖动按 requestAnimationFrame 合并输入，只绘制最新位置；不随旋转变化的几何只计算一次。运动期间使用误差小于一个逻辑像素的海岸简化，停止后恢复完整 Natural Earth 几何；城市坐标、纬线和纬带保持原始坐标。Canvas 按实际显示尺寸与设备像素比调整分辨率，像素比最多取 2。

另修复松开鼠标后的经度回写触发二次回中：对本地拖动的回写进行确认，保留用户的垂直视角。指针取消、丢失捕获和组件卸载都会清理拖动状态及动画。

## 同场景对照

Windows 系统 Chrome headless、1440×1100、相同本地生产服务器、4 秒 CDP 鼠标拖动、请求 120 Hz 输入。CPU 原生速度与 4 倍限速各测三轮，观察器在两版一致。真实输入会被浏览器合并，原始报告保留实际投递数及持续时间。

| 4 倍 CPU 限速，三轮    | V2 基线                | 本轮优化              |
| ---------------------- | ---------------------- | --------------------- |
| 帧间隔 p95             | 62.4 / 62.5 / 83.4 ms  | 48.6 / 41.6 / 34.8 ms |
| 超过 50 ms 的长任务数  | 34 / 39 / 46           | 8 / 3 / 0             |
| 输入到经度文本更新 p95 | 67.6 / 69.9 / 104.9 ms | 58.4 / 45.9 / 39.0 ms |

三轮 p95 的中位数为 62.5 → 41.6 ms，降低约 33%；输入到经度文本更新的 p95 中位数为 69.9 → 45.9 ms。原生速度下两版均未观测到长任务，新版帧间隔 p95 约 7 ms。

这里的帧间隔衡量主线程可执行动画帧的机会，文本更新衡量 DOM 提交延迟，均不是屏幕实际出光延迟。CPU 限速不代表某款具体手机，结果不能表述为所有设备都达到 60 FPS。

原始证据：[基线](performance/baseline.json)、[优化后](performance/optimized.json)、[交互检查](performance/interaction.json)。

## 可复现步骤

先启动生产构建，例如在独立端口运行：

```sh
pnpm build
pnpm exec next start --hostname 127.0.0.1 --port 3100
```

另一个终端使用已安装的 Chrome：

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
node scripts/benchmark-globe.mjs current http://127.0.0.1:3100
```

默认报告写入已忽略的 `work/globe-perf-current.json`。使用 Playwright 自带 Chromium 时，安装浏览器后不设置 `PLAYWRIGHT_CHANNEL`。进行版本对照应保持浏览器、视口、CPU 参数、运行模式和输入轨迹相同。

## 交互与视觉验证

1440px 桌面及 390px、DPR 3 手机均检查了 Canvas/SVG 分层对齐、二维拖动松手后位置稳定、减少动效复位、pointercancel、lostpointercapture 和取消后继续拖动，页面错误为 0。原有 SVG 标记点击、键盘操作和背面裁切继续由浏览器回归覆盖。
