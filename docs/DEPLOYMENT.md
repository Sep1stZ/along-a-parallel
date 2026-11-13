# 部署到公开网站

GitHub 保存代码。公开网站还需要托管运行服务。可以使用有 Git 仓库导入功能的托管平台，不必自行购买、维护虚拟机。本项目的关键要求是 **Node.js 24、单实例和可写的持久磁盘**，因为匿名收藏与分享快照存在 SQLite 中。

## 当前交付状态

**V2.1 已于 2026-11-13 更新到原公开地址：[沿着一条纬线](https://parallel-6a30a9330b.sealoshzh.site/)，线上验收通过。** 运行源码提交为 `2db298134941741b50c0b67f44c880d14f2a700a`，固定镜像为：

```text
ghcr.io/sep1stz/along-a-parallel@sha256:890ed23ebba13e588dfd1665ee1167eaa85599c8f14579f5a5f28dfda3dd98d0
```

[Checks 43404464901](https://github.com/Sep1stZ/along-a-parallel/actions/runs/43404464901) 成功，33 项测试和 21 项浏览器测试通过；[Container 43404464836](https://github.com/Sep1stZ/along-a-parallel/actions/runs/43404464836) 成功完成构建、真实资源受限容器验证与 GHCR 发布。该镜像已匿名核验为 Linux amd64、非 root `node` 用户，11 个数据层 HEAD 均为 200。

在 0.2 CPU、256 MiB 内存、Node 堆 160 MiB 条件下，本轮实测初次导入峰值 178.2 MiB、重启峰值 117.6 MiB、替换后峰值 117.1 MiB，无 OOM。线上部署沿用原 StatefulSet 与原 PVC，实例 Ready=true、重启计数 0；旧 V2 测试所有者的收藏、旅程和已撤销分享 410 状态保留。发布前 SQLite WAL 一致性备份完整性检查为 `ok`，备份仅在受控本地私存。

线上 36 项 API 与持久化检查，以及 21 项完整生产浏览器测试全部通过。再次真实替换 V2.1 实例后，新分享中的速读与地理档案、收藏和私人旅程保留，撤销功能有效，原 PVC 不变，实例 Ready、重启计数 0。范围及证据见 [验证记录](VERIFICATION.md)。后续文档与截图提交不会改变此处固定的运行版本。

V2.1 保留 34,214 个地点、60 城 240 篇四主题手记、8 条路线与 30 条自然观察，增加全部地点的地理档案及 165 篇、330 段城市速读（57 个国家/地区代码）。速读与精选城市有重叠，百科节选及其文字整理采用独立的 CC BY-SA 4.0；原地理数据继续采用 CC BY 4.0。原来源待核验边界见 [内容说明](CITY-ARTICLES.md) 和 `SOURCES.md`。

地球采用 Canvas 底图、SVG 交互标记与动画帧合并绘制；相同本地场景、4 倍 CPU 限速下三轮帧间隔 p95 中位数降低约 33%。该结果不等于物理 FPS 或所有设备的性能保证，详见 [性能记录](PERFORMANCE.md)。

资源仍为原试用站的单实例 200m CPU、256Mi 内存和 1Gi 持久卷，未购买、充值或升级。示例配置已固定本轮验证镜像；临时系统域名、平台余额与实际网络访问仍影响可用性。以下 V2、V1 记录保留作历史追溯。

## V2 历史部署记录（2026-11-11）

**V2 已于 2026-11-11 更新到原公开地址：[沿着一条纬线](https://parallel-6a30a9330b.sealoshzh.site/)。** 当前收录 34,214 个地点、60 座精选城市、8 条路线与 30 条自然观察，沿用原 200m CPU、256Mi 内存和 1Gi 持久卷。

[Container 42989875070](https://github.com/Sep1stZ/along-a-parallel/actions/runs/42989875070) 已完成生产构建、同规格小内存容器 smoke 和 GHCR 发布；[Checks 42989874995](https://github.com/Sep1stZ/along-a-parallel/actions/runs/42989874995) 也成功。线上验收及实例替换的数据保留证据见[验证记录](VERIFICATION.md)。

运行代码提交为 `2f5735ed5ccc87ec18e4cc31e5b77cbf36ecce56`，固定镜像为：

```text
ghcr.io/sep1stz/along-a-parallel@sha256:0f225928401e34f005795ce1de9305077c477d383578c14a44478233d48dd6d0
```

该镜像已匿名核验为 Linux amd64、非 root `node` 用户，11 个数据层均可公开读取。V2 初次发布时测得首次导入容器峰值 173.7 MiB，最终修正也通过同规格容器测试；未购买或升级资源。后续文档和截图提交不会改变此处固定的运行版本。

线上与示例 Ingress 的请求体上限均为 `3m`，应用对旅程导入保留 2 MiB 上限。实测 1,100,000 字节的有效 JSON 可导入，2,097,153 字节返回应用 JSON 413，避免代理先于应用拒绝合理文件。

V2 使用版本化迁移、按需详情与本地目录文件。迁移前已做包含 WAL 的一致性备份与独立恢复演练。日常备份可执行 `node scripts/backup-db.mjs backup <live.sqlite> <new-backup.sqlite>`；恢复先创建独立新文件并验证，再停服务切换 `DB_PATH`。不能直接覆盖活动数据库。备份、kubeconfig 和会话信息不得进入 Git 仓库。

公开站仍使用试用余额和临时系统域名；费用及长期使用条件见下方。以下 V1 发布记录仅作历史追溯。

## V1 历史部署记录

**试用验收站已上线：[沿着一条纬线](https://parallel-6a30a9330b.sealoshzh.site/)。** 2026-11-10 在 Sealos 杭州区完成 40 项线上接口与部署检查，以及 11 项真实浏览器测试（32.6 秒）。HTTPS 证书校验成功，HTTP 自动跳转 HTTPS；实际替换应用实例后，收藏、私人旅程和冻结分享快照均从原持久卷恢复。完整结果见[验证记录](VERIFICATION.md)。

[Container 任务 42826836278](https://github.com/Sep1stZ/along-a-parallel/actions/runs/42826836278) 已成功完成提交 `a4158bcb5e4c81caa7ea06c267aed79271f627e0` 的 Docker 生产构建、真实容器 smoke 和 GHCR 发布。smoke 包含接口、匿名会话、收藏所有权、分享快照，以及使用持久卷重启和替换容器后的数据保留。

该版本发布后的匿名读取确认，验收时以下两个标签指向同一应用镜像（`latest` 会随后续发布变化）：

```text
ghcr.io/sep1stz/along-a-parallel:latest
ghcr.io/sep1stz/along-a-parallel:sha-a4158bcb5e4c81caa7ea06c267aed79271f627e0
```

固定版本可使用以下 digest，避免后续标签更新改变部署内容：

```text
ghcr.io/sep1stz/along-a-parallel@sha256:9f2d905549fe932f166cc606e67d30e1ab5e59c558d98d272129c9003e1e30ab
```

镜像配置为 `linux/amd64`、`USER=node`，全部 10 个数据层的匿名 HEAD 请求均返回 HTTP 200。当前 Sealos 部署已验证实际拉取、启动、持久卷权限、HTTPS 和本次测试网络访问；迁移到其他环境时应重新验收。

## 当前试用站配置与费用

当前使用 Sealos 杭州区（阿里云），1 个应用实例、200m CPU（0.2 核）、256Mi 内存（0.25 GiB）及 1Gi 持久卷。数据库挂载在 `/app/.data`，`APP_ORIGIN` 设置为实际 HTTPS 地址。无需自行购买或维护虚拟机。

仓库提供不含账号、命名空间或凭据的 [Sealos 配置示例](../deploy/sealos.example.yaml)，固定已验证镜像 digest，并包含单实例、持久卷、健康检查和非 root 运行设置。复用时替换示例域名、TLS 配置及所选平台要求的参数，再执行部署验收。

2026-11-10 核对的资源单价如下，实际账单以控制台为准：

| 资源     | 当前用量 | 单价                       |
| -------- | -------- | -------------------------- |
| CPU      | 0.2 核   | ¥0.0276706 / 核 / 小时     |
| 内存     | 0.25 GiB | ¥0.0139558912 / GiB / 小时 |
| 持久存储 | 1 GiB    | ¥0.000845824 / GiB / 小时  |

基础资源按全天运行估算：`24 × (0.2 × 0.0276706 + 0.25 × 0.0139558912 + 1 × 0.000845824) = ¥0.2368540032 / 天`，约 **¥0.237 / 天**。¥5 约覆盖 **21 天基础资源**，不含流量及其他费用，也不保证实际可用时长；价格、余额和账单以平台当前信息为准。

该地址使用平台临时系统域名，适合开发、调试和试用验收。长期自定义公网域名需遵守平台的 ICP 等接入要求。根据 [Sealos 服务条款第 4.4 条](https://sealos.cn/legal/terms-of-service)，余额不足可能导致停服，数据最多保留 14 天，之后可能删除。普通暂停应用且保留持久卷时，存储仍可能计费；需要保留的数据应及时备份。

## 选择托管方式

| 方式                             | 当前项目的适配情况                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 支持 Docker 与持久磁盘的托管平台 | 最接近当前架构，可导入仓库并使用随仓库提供的 Dockerfile。需要登录平台、确认资源额度/费用和持久卷。平台通常可以分配子域名。                                                                   |
| Sealos App Deploy                | 当前试用验收站已在杭州区部署并通过线上接口、浏览器及实例替换持久化验收；使用临时系统域名，费用与长期域名要求见上文。                                                                         |
| Render Docker 服务               | 提供待部署的 `render.yaml` 蓝图：新加坡、单实例、1 GB 数据卷。实际可用区域、规格和账单须以创建服务时的控制台为准。未创建或验证线上服务。                                                     |
| EdgeOne Pages / Makers           | 官方框架文档列出 Next.js 16 与 Node 函数支持；本次没有找到可以保证当前 SQLite 文件跨实例、重启保留的本地磁盘能力说明。需要先核验运行时并将数据库适配到持久后端，才能交付完整收藏和分享功能。 |
| Vercel                           | 官方明确说明 serverless 本地存储无法持久、共享 SQLite。需要先迁移到外部数据库。                                                                                                              |
| Netlify                          | 函数使用临时运行环境。当前本地 SQLite 存储需要改用其持久数据库或外部数据库。                                                                                                                 |
| GitHub Pages                     | 静态网站托管，不能直接运行本项目的 Node 接口和 SQLite。                                                                                                                                      |

Sealos App Deploy 支持单容器应用、平台公开地址和持久卷，本次试用站使用此方式部署已发布镜像。也可以从 DevBox 构建 OCI 镜像后发布到 App Deploy。新建或迁移服务前应确认所选区域、资源报价与目标网络访问。

国内控制台入口是 [cloud.sealos.run](https://cloud.sealos.run/)，目前可转到杭州区登录。根据 [Sealos 国内服务条款](https://sealos.cn/legal/terms-of-service)，大陆区域需本人实名认证；系统自动分配的域名用于开发、调试和临时访问，不应视为长期生产入口。长期使用自定义公网域名时需按平台和接入商要求办理 ICP 及接入备案。可先在试用额度内发布临时验收站，再决定正式域名；试用额度、有效期和资源费用以登录后的控制台为准。

当前站点已从本次测试网络完成首页、接口、收藏刷新恢复、分享快照和 HTTPS 验收。该结果不能证明所有中国大陆运营商和地区都可访问，长期使用前还应在实际使用网络检查访问质量。

## 方案一：导入仓库到 Docker 托管平台

1. 用户登录选定的平台，授权导入项目 GitHub 仓库。
2. 创建 Docker Web 服务，使用根目录 `Dockerfile`。镜像内已安装 Node.js 24，平台无需通过 Node 版本自动识别。
3. 挂载一个**持久数据卷**到 `/app/.data`，使容器用户 `node`（UID 1000）有读写权限。设置 `DB_PATH=/app/.data/parallel.sqlite`，保持一个应用实例。
4. 平台将服务映射到容器端口 `3000`；镜像也会读取平台注入的 `PORT`。应用监听 `0.0.0.0`。健康检查路径为 `/api/routes`。
5. 平台分配公开 HTTPS 地址后，设置 `APP_ORIGIN` 为实际地址，例如 `https://your-assigned-host.example`，不包含页面路径。自定义域名可选。
6. 部署并实际验证。重启或重新部署应用后，收藏和分享必须仍然存在，才算数据卷配置成功。

`render.yaml` 是以上结构的一份 Render 蓝图，可从平台的 Blueprint / Git 仓库导入入口使用。其 `starter` 计算规格和数据卷可能收费；创建前检查控制台报价。该蓝图不创建账号、不自动购买资源、不承诺区域或域名在大陆可达。镜像已在 GitHub Actions 中实际构建并通过容器 smoke；Render 蓝图本身尚未通过平台创建线上服务验证。

Sealos 可使用 DevBox 将仓库代码构建为 OCI 镜像，再在 App Deploy 部署；也可以部署已经发布的容器镜像。配置一个固定实例、容器端口 `3000`、公开访问、数据卷 `/app/.data` 以及实际分配域名对应的 `APP_ORIGIN`。该平台官方持久存储文档要求同时验证重启和重新部署后数据仍保留；请使用同样标准验收。Node.js 版本由本项目 Dockerfile 固定为 24，若使用 DevBox 自带运行时，应先确认其 Node 版本再构建。

容器首次健康检查会初始化数据库和种子内容。替换镜像会更新策展资料，不会清空同一持久卷中的用户记录。不要把私人数据库提交到仓库或打包进镜像。

### 使用 GitHub Actions 构建镜像

仓库的 `Container` 工作流在 `main` 推送或手动触发时构建 Linux 镜像，先启动实际容器验证接口、匿名会话、收藏所有权、分享快照，以及容器重启和替换后的持久化。只有验证成功，才使用该次任务的 `GITHUB_TOKEN` 登录 GitHub Container Registry 并推送：

```text
ghcr.io/sep1stz/along-a-parallel:latest
ghcr.io/sep1stz/along-a-parallel:sha-完整提交SHA
```

工作流只申请仓库读取和 `packages:write`，不需要在仓库另存长期注册表密码或把令牌填入应用。镜像标签、源仓库和提交号一起记录；验收时优先使用与成功任务对应的 SHA 标签，避免后续 `latest` 更新改变部署版本。构建和验证是否已通过，应查看实际 Actions 任务结果，不能仅凭工作流文件存在判断。

GHCR 新建包可能默认为私有，源仓库公开不代表镜像包也公开。本项目上方列出的已验证版本已通过匿名应用 manifest、配置与全部数据层 HEAD 检查，无需向托管平台提交个人 GitHub 令牌来读取该公开镜像。未来发布到其他包或变更可见性后，应重新验证未登录访问；GHCR 在部署区域的实际拉取速度、平台余额与实例报价也应在部署时核实。

## 方案二：已有服务器上使用 Docker Compose

此方案适用于已经有 Linux 服务器和域名的用户。需要 Docker Engine、Compose 插件，域名 A/AAAA 记录已指向服务器，防火墙允许 TCP 80/443（UDP 443 可选）。在中国大陆服务器开通网站，需按云厂商与主管部门要求完成 ICP 等手续；境外部署也需要实测大陆访问质量。

```sh
git clone https://github.com/Sep1stZ/along-a-parallel.git
cd along-a-parallel
cp deploy/.env.example deploy/.env
```

编辑 `deploy/.env`，将 `DOMAIN=atlas.example.com` 换成实际域名，不加 `https://` 或路径，然后运行：

```sh
docker compose --env-file deploy/.env up -d --build
docker compose --env-file deploy/.env ps
docker compose --env-file deploy/.env logs --tail=100 app caddy
```

Caddy 申请与续期 HTTPS 证书并转发请求；Next 服务只在容器网络内暴露。命名卷 `journey_data` 保留数据库；`caddy_data` 与 `caddy_config` 保存证书状态。Compose 会设置规范公开地址 `APP_ORIGIN=https://你的域名`。

更新应用时使用相同项目目录、Compose 项目名称与数据卷：

```sh
git pull --ff-only
docker compose --env-file deploy/.env up -d --build
```

保留所有数据卷；不要运行会删除数据卷的清理命令。备份时先停止应用写入，再通过托管平台磁盘快照或 SQLite 一致性备份方式复制整个数据库状态。若要横向扩容，先把 SQLite 改为共享数据库。

## 反向代理和公开地址

`APP_ORIGIN` 是服务端配置，取值为单个 `http(s)` origin，例如 `https://atlas.example.com`，允许末尾 `/`，禁止用户名、密码、查询参数和页面路径。设置后：

- 写请求的 `Origin` 必须与此规范地址一致。
- HTTPS 对外服务使用 `Secure` 匿名 Cookie，即使代理与 Next 之间使用内部 HTTP。
- 分享链接使用规范公开地址，不依赖客户端传入的 Host 或转发头。

未设置时保持本地行为：依据请求协议和 Host 校验同源，不信任任意 `X-Forwarded-Host`。更换域名后需同步更新 `APP_ORIGIN` 并重启服务。

## 本次查阅的官方资料

查阅日期：2026-11-10。

- [Next.js 自托管](https://nextjs.org/docs/app/guides/self-hosting)：同时阅读了当前安装版本随包文档，采用反向代理、单实例持久磁盘与 standalone 输出。
- [Next.js standalone 输出](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)：Docker 构建单独启用，常规 Windows 本地构建保持原有模式。
- [EdgeOne Next.js 支持](https://pages.edgeone.ai/document/framework-nextjs) 与 [Node 函数](https://pages.edgeone.ai/document/node-functions)：实际读取，不能据此推断提供持久 SQLite 磁盘。
- [Vercel 是否支持 SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)：实际读取，官方说明临时文件系统不适合该持久化模型。
- [Netlify Functions](https://docs.netlify.com/build/functions/overview/)：实际读取，函数在临时运行环境执行。
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)：实际读取，提供静态网站托管。
- [腾讯云网站备案](https://cloud.tencent.com/document/product/243/39038)：实际读取，中国大陆境内服务器的网站须先完成备案再开通访问。
- [Sealos 部署入门](https://sealos.io/docs/guides/app-deploy/first-deploy/)、[持久卷](https://sealos.io/docs/guides/app-deploy/persistent-volume/) 与 [Next.js 开发到部署流程](https://sealos.io/docs/quick-start)：实际读取。平台入口请求成功不代表已验证其特定部署区域或所有大陆网络。
- [Sealos 国内源码部署](https://sealos.cn/docs/getting-started/deploy-github-repo)、[Docker 部署](https://sealos.cn/docs/getting-started/deploy-docker-image) 与 [服务条款](https://sealos.cn/legal/terms-of-service)：已核对 Git 仓库导入、公开地址、存储、实名认证及系统域名的使用边界。
- [Sealos 计费说明](https://sealos.cn/docs/billing)：资源按量计费；上文估算不包含流量等额外费用，当前价格与余额以控制台为准。
- [Render 数据盘文档](https://render.com/docs/disks)、[区域](https://render.com/docs/regions) 与 [定价](https://render.com/pricing)：本次直接请求超时，蓝图尚未通过平台实际创建验证；费用、区域与资源可用性必须在控制台再次核实。

当前公开试用站的上线证据见[验证记录](VERIFICATION.md)。后续迁移、镜像更新或域名变更后需重新检查运行与持久化；持续可用性仍取决于平台资源、余额和域名政策。
