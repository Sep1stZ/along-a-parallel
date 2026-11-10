# 沿着一条纬线 · Along a Parallel

**同一条纬线，很多种生活。**

一个可以在本地运行的中文地理与人文探索网站。转动真实地图上的地球，沿北纬 30°、北纬 45°与南纬 23°附近的纬度带，阅读 16 座城市的故事，比较两地，收藏并分享旅程。

An open-source, locally runnable atlas of places and everyday life. Explore sixteen cities through an interactive globe, read illustrated stories, compare places, and save or share a journey. The interface and editorial content are primarily in Simplified Chinese.

[在线体验：沿着一条纬线](https://parallel-6a30a9330b.sealoshzh.site/)（Sealos 杭州试用验收站，临时演示域名；可用性取决于托管余额）。

![沿着一条纬线桌面探索界面](docs/screenshots/desktop.png)

## 本地运行 / Quick start

需要 **Node.js 24 或更新版本**和 pnpm。数据库使用 Node 内置的 `node:sqlite`，不需要单独安装数据库服务或商业 API Key。

```sh
pnpm install
pnpm db:init
pnpm dev
```

打开 <http://127.0.0.1:3000>。生产方式运行：

```sh
pnpm build
pnpm start
```

Windows 下安装依赖后，也可以双击 `start-local.cmd` 打开浏览器并启动本地服务。已构建时使用生产模式；关闭命令窗口即停止服务。

仓库发布与网站托管是两件事。以上命令启动本机服务；如需公开网站，需要将应用部署到支持 Node.js 24 和持久磁盘的服务器。

也可以导入仓库到支持 Docker 和持久数据卷的托管平台，无需自行维护服务器。项目提供 Dockerfile、Render 蓝图及带 HTTPS 的 Compose 示例；见 [公开部署指南](docs/DEPLOYMENT.md)。托管平台账号、费用与大陆访问情况需在实际部署时确认。

## 产品功能

- D3 正射投影地球、真实海岸线、经纬网、精确纬线和半透明纬度带。
- 三个预设纬度带与自定义中心纬度；城市使用真实经纬度，按经度循环探索。
- 16 座城市的本地原创示意插画、自然地理、城市建筑、日常与饮食故事，以及资料来源。
- 两座城市的逐项比较、实际纬度和时区时间。
- 匿名收藏、探索记录与旅程恢复，服务端写入 SQLite。
- 公开只读分享快照：创建后的私人旅程变化不会改写已发布快照。
- 可恢复探索与比较的 URL；地图之外提供城市列表，支持键盘操作与减少动效偏好。

北纬 30°附近收录杭州、成都、拉萨、设拉子、开罗、马拉喀什、新奥尔良、休斯敦。另两条路线各收录四座城市。默认带宽为 **±2 个纬度度数**，查询条件为 `abs(city.latitude - center) <= band`。经度顺序只用于探索，不代表真实公路、航线或完整文化覆盖。

## 数据与运行边界

地图、插画、种子内容均随项目保存，基础阅读与操作在运行期不需要外部网络；首次安装依赖需要联网。时间通过地点 IANA 时区和当前设备时间计算。内容是静态策展资料，并非实时旅行、气象或人口数据。

插画明确为原创示意，不是真实照片。资料核验状态和事实范围记录在城市来源及 [SOURCES.md](SOURCES.md) 中；完整素材信息见 [assets-manifest.json](assets-manifest.json)。第三方网页仍属于各自权利人，项目不转授其全文版权。

## 数据库与配置

默认数据库位于项目目录下的 `.data/parallel.sqlite`，WAL 辅助文件也在同目录。目录已加入 `.gitignore`，匿名会话、收藏与私人旅程不会进入 Git 仓库。

`.env.example` 列出了可选配置：

```dotenv
DB_PATH=.data/parallel.sqlite
# 公开 HTTPS 服务或反向代理部署时设置；本地运行不需要。
# APP_ORIGIN=https://atlas.example.com
```

可将它复制为 `.env.local`，使用绝对路径或相对项目目录的路径。运行数据库脚本时，如需使用自定义位置，请在运行脚本的 shell 中设置 `DB_PATH`；脚本本身不读取 Next.js 的 `.env.local`。

首次接口调用也会初始化数据库并导入内容。`pnpm db:init` 与 `pnpm db:seed` 可重复执行：以固定 ID 更新策展内容，不清空用户收藏、旅程或分享快照。数据库 schema 和迁移版本记录位于 `src/lib/server/store.ts`。

部署必须有**可写且持久的磁盘**，并保留 `.data` 或配置的数据库文件。适合单实例 Node 服务；多实例部署应先迁移到共享数据库。没有持久磁盘的 serverless 环境需要替换存储实现。备份数据库时应停止写入或使用 SQLite 备份方式，避免只复制仍在写入的主文件。

## 匿名会话与分享

服务端生成随机会话令牌，以 `HttpOnly`、`SameSite=Lax` Cookie 保存；HTTPS 下启用 `Secure`。数据库保存会话令牌的 SHA-256 摘要。会话有效期为 180 天，清理 Cookie 或更换浏览器后不会自动找回原匿名旅程。

所有私人读写从当前 Cookie 解析所有者，不接受客户端指定会话 ID。写请求进行同源检查，JSON 输入经过 Zod 校验，并限制请求体大小。私人接口使用 `private, no-store`。分享链接使用不可预测的随机令牌，仅提供快照读取，不返回匿名会话标识或私人旅程修改权限。

分享链接的持有者可以读取快照内容，包括分享时保存的收藏和探索记录。请只主动分享希望公开的旅程。

## 接口 / API

| 方法        | 地址                              | 用途                                            |
| ----------- | --------------------------------- | ----------------------------------------------- |
| GET         | `/api/routes`                     | 路线预设                                        |
| GET         | `/api/places?latitude=30&band=2`  | 纬度带内城市，按经度排序                        |
| GET         | `/api/places/:id`                 | 城市故事与来源                                  |
| GET         | `/api/compare?ids=hangzhou,cairo` | 两座城市的比较资料                              |
| GET / POST  | `/api/favorites`                  | 读取收藏 / 提交 `{ "placeId": "hangzhou" }`     |
| DELETE      | `/api/favorites/:placeId`         | 取消当前会话收藏                                |
| GET / PATCH | `/api/journey`                    | 读取 / 保存当前会话旅程                         |
| POST        | `/api/journey/share`              | 提交可选 `{ "name": "我的旅程" }`，创建只读快照 |
| GET         | `/api/shared/:token`              | 公开读取快照                                    |

## 开发与验证

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

使用 `pnpm format` 统一格式，或 `pnpm format:check` 检查。GitHub Actions 会执行类型检查、lint、单元测试、生产构建和浏览器测试。

首次运行 Playwright 测试可能需要 `pnpm exec playwright install chromium`。如使用已有系统 Chrome，可设置环境变量 `PLAYWRIGHT_CHANNEL=chrome`。实际执行过的检查、浏览器尺寸与已知限制记录在 [docs/VERIFICATION.md](docs/VERIFICATION.md)。请以该记录为准，不能仅凭测试脚本存在判断已经通过。

主要代码结构：

```text
src/app/             页面与服务端 API
src/components/      地球、探索与阅读交互
src/data/            城市内容和预设路线
src/lib/geo.ts       经纬度、URL 与纬度带逻辑
src/lib/server/      SQLite、会话和输入校验
public/maps/         本地真实世界地图
public/art/          原创城市示意插画
scripts/             可重复执行的数据库初始化
tests/               核心行为测试
```

技术栈为 Next.js App Router、React、TypeScript、D3-geo、Lucide、Zod 和 SQLite。视觉系统使用项目级 CSS 变量和随项目提供的 Noto Sans SC 本地字体，不依赖远程字体服务；其他文字使用系统字体回退。

## 新增城市

1. 在 `src/data/places.ts` 中增加稳定的城市 ID、实际坐标、IANA 时区、简介与四个主题故事；至少提供两项可靠来源，注明访问日期、事实范围及核验状态。
2. 将可以合法使用的素材放入 `public/art/`，补齐署名、来源和许可。原创示意插画也应明确标注。
3. 如属精选路线，将 ID 加入 `src/data/routes.ts`；纬度查询仍以实际坐标为准。
4. 更新素材清单和 `SOURCES.md`，运行 `pnpm db:seed` 与检查命令，并实际检查地图位置、故事和移动端排版。

## 许可 / License

代码、原创文字与原创 SVG 示意插画按 [MIT License](LICENSE) 发布。Natural Earth 地理数据为公有领域数据；Noto Sans SC 字体遵循随附的 SIL OFL 许可。具体版本、来源与处理方式见素材清单。欢迎在保留来源、尊重地点差异的前提下继续补充城市与故事。
