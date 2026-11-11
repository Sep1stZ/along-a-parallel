# 沿着一条纬线 · Along a Parallel

**同一条纬线，很多种生活。**

一部可以在本地运行的中文地理人文图册。V2 收录 **34,214 个真实地点、60 座精选城市、8 条纬度路线和 30 条自然观察**，支持全球搜索、比较、收藏、旅程导入导出与分享撤销。

An open-source atlas with 34,214 geographical places, 60 curated cities, eight latitude routes and 30 natural observations. Search the world, explore a globe, compare places, and export or share a journey. The interface and editorial content are primarily in Simplified Chinese.

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
- 八个预设纬度带与自定义中心纬度，±1° / ±2° / ±5° / ±10° 范围和密度提示；按真实经度循环探索整个纬度带。
- 中文、英文和别名搜索，同名地点显示国家/地区与行政区。摘要每页最多 60 条，详情按需加载；地图聚合邻近标记并保留选中地点。
- 基础地点与精选手记分层；60 座精选城市有四主题原创手记和示意插画，另有 30 条自然观察与资料来源。
- 两座城市的逐项比较、实际纬度、时区时间和已收录海拔。缺失值保留为空，未接入气候常年值。
- 匿名收藏、探索记录与旅程恢复，服务端写入 SQLite。
- JSON 旅程导出与合并导入，探索记录支持超过 100 个地点；界面显示最近 200 条记录，导出包含完整记录。
- 公开只读分享快照最多含 60 个完整地点，创建后保持冻结；作者可查看和撤销自己的分享。V1 旧快照继续保持原样。
- 可恢复探索与比较的 URL；地图之外提供城市列表，支持键盘操作与减少动效偏好。

默认 **±2°** 时，181 个整度中心纬度中有 **132 个**在本目录内存在地点（V1 为 15 个）。这是选择性名录的覆盖统计，不能代表全部聚落或人口分布。空白处可主动前往邻近有数据纬度或扩大范围；经度顺序不代表真实公路或航线。

基础目录来自 2026-11-11 GeoNames cities15000 快照：34,214 条记录中，11,296 条有带中文语言标签的名称，22,918 条保留来源原名。精选覆盖后的最终显示名统计见 `/api/catalog`。全部坐标和 IANA 时区通过校验，4,495 条有明确海拔，其他为 `null`；人口缺少一致统计年份，因此未展示。

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

首次接口调用会初始化数据库并按版本导入内容。`pnpm db:init` 与 `pnpm db:seed` 可重复执行，目录未变化时不重写内容。迁移保留旧 16 城 ID、用户收藏、探索记录及冻结分享。数据库 schema 和迁移版本位于 `src/lib/server/store.ts`。

目录已随源码发布，普通运行无需下载完整别名源包。维护者离线重建可运行 `node scripts/import-catalog.mjs --offline`；首次获取缓存与更新快照见[导入说明](scripts/import-catalog.README.md)。来源校验和、中文名覆盖、缺失统计与纬度覆盖保存在 `src/data/catalog-report.json`。

一致性备份与恢复（目标必须为新文件，包含已提交 WAL 页）：

```sh
node scripts/backup-db.mjs backup .data/parallel.sqlite /safe/path/backup.sqlite
node scripts/backup-db.mjs restore /safe/path/backup.sqlite /safe/path/restored.sqlite
```

恢复命令创建独立的、经过完整性和外键检查的数据库。先停止服务，再把 `DB_PATH` 切到验证后的恢复文件；不得覆盖活动数据库。不要提交数据库、会话信息或 kubeconfig。

部署必须有**可写且持久的磁盘**，并保留 `.data` 或配置的数据库文件。适合单实例 Node 服务；多实例部署应先迁移到共享数据库。没有持久磁盘的 serverless 环境需要替换存储实现。备份数据库时应停止写入或使用 SQLite 备份方式，避免只复制仍在写入的主文件。

## 匿名会话与分享

服务端生成随机会话令牌，以 `HttpOnly`、`SameSite=Lax` Cookie 保存；HTTPS 下启用 `Secure`。数据库保存会话令牌的 SHA-256 摘要。会话有效期为 180 天，清理 Cookie 或更换浏览器后不会自动找回原匿名旅程。

所有私人读写从当前 Cookie 解析所有者，不接受客户端指定会话 ID。写请求进行同源检查，JSON 输入经过 Zod 校验，并限制请求体大小。私人接口使用 `private, no-store`。分享链接使用不可预测的随机令牌，仅提供快照读取，不返回匿名会话标识或私人旅程修改权限。

分享链接的持有者可以读取快照内容。请只主动分享希望公开的旅程；撤销后公开 API 返回 410，网页显示已撤销提示。清除 Cookie 前可导出 JSON 备份，导出不含会话标识。普通请求体上限 16 KiB，专用导入上限 2 MiB、每类最多 50,000 个唯一有效地点 ID，并使用事务合并。

## 接口 / API

| 方法         | 地址                                                                               | 用途                                            |
| ------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| GET          | `/api/routes`                                                                      | 路线预设                                        |
| GET          | `/api/catalog`                                                                     | 目录版本、数量与 181 个纬度的覆盖               |
| GET          | `/api/places?latitude=30&band=2&level=all&limit=60&offset=0`                       | 轻量摘要分页，支持 `level=curated`              |
| GET          | `/api/places?q=Tokyo&limit=12`                                                     | 全局名称和别名搜索                              |
| GET          | `/api/places?ids=hangzhou,cairo`                                                   | 最多 200 个 ID 的摘要                           |
| GET          | `/api/places/nearby?latitude=30&band=2&longitude=120&direction=east&from=hangzhou` | 全纬度带东西/最近地点，支持循环                 |
| GET          | `/api/places/:id`                                                                  | 城市故事与来源                                  |
| GET          | `/api/compare?ids=hangzhou,cairo`                                                  | 两座城市的比较资料                              |
| GET / POST   | `/api/favorites`                                                                   | 读取收藏 / 提交 `{ "placeId": "hangzhou" }`     |
| DELETE       | `/api/favorites/:placeId`                                                          | 取消当前会话收藏                                |
| GET / PATCH  | `/api/journey`                                                                     | 读取 / 保存当前会话旅程                         |
| GET / POST   | `/api/journey/export` / `/api/journey/import`                                      | V2 JSON 导出 / 合并导入                         |
| GET / DELETE | `/api/shares` / `/api/shares/:token`                                               | 本人的分享列表 / 撤销                           |
| POST         | `/api/journey/share`                                                               | 提交可选 `{ "name": "我的旅程" }`，创建只读快照 |
| GET          | `/api/shared/:token`                                                               | 公开读取快照                                    |

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

1. 在 `src/data/curated-v2.ts` 中增加稳定 ID、GeoNames 映射、实际坐标、IANA 时区、简介与四个主题故事（键为 `geography`、`architecture`、`life`、`food`）；至少提供两项可靠来源，注明访问日期、事实范围及核验状态。编辑记录见 [CONTENT-V2.md](docs/CONTENT-V2.md)。
2. 将可以合法使用的素材放入 `public/art/`，补齐署名、来源和许可。原创示意插画也应明确标注。
3. 如属精选路线，将 ID 加入 `src/data/routes.ts`；纬度查询仍以实际坐标为准。
4. 更新素材清单和 `SOURCES.md`，用 `scripts/build-font-subset.py` 重建字形（需要经脚本校验的上游 TTF、Python、fontTools 4.68、Brotli 1.2）。运行 `pnpm db:seed` 与检查命令，实际检查地图位置、故事和移动端排版。

## 许可 / License

代码、原创文字与原创 SVG 按 [MIT License](LICENSE) 发布。GeoNames 原始及加工后的地理数据独立适用 **CC BY 4.0**，保留 GeoNames 署名及加工说明；Natural Earth 数据为公共领域，字体遵循 SIL OFL 1.1。第三方参考页面属于各自权利人。具体版本、来源与处理方式见素材清单。
