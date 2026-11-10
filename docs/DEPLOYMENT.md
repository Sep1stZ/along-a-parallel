# 部署到公开网站

GitHub 保存代码。公开网站还需要托管运行服务。可以使用有 Git 仓库导入功能的托管平台，不必自行购买、维护虚拟机。本项目的关键要求是 **Node.js 24、单实例和可写的持久磁盘**，因为匿名收藏与分享快照存在 SQLite 中。

## 选择托管方式

| 方式                             | 当前项目的适配情况                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 支持 Docker 与持久磁盘的托管平台 | 最接近当前架构，可导入仓库并使用随仓库提供的 Dockerfile。需要登录平台、确认资源额度/费用和持久卷。平台通常可以分配子域名。                                                                   |
| Render Docker 服务               | 提供待部署的 `render.yaml` 蓝图：新加坡、单实例、1 GB 数据卷。实际可用区域、规格和账单须以创建服务时的控制台为准。未创建或验证线上服务。                                                     |
| EdgeOne Pages / Makers           | 官方框架文档列出 Next.js 16 与 Node 函数支持；本次没有找到可以保证当前 SQLite 文件跨实例、重启保留的本地磁盘能力说明。需要先核验运行时并将数据库适配到持久后端，才能交付完整收藏和分享功能。 |
| Vercel                           | 官方明确说明 serverless 本地存储无法持久、共享 SQLite。需要先迁移到外部数据库。                                                                                                              |
| Netlify                          | 函数使用临时运行环境。当前本地 SQLite 存储需要改用其持久数据库或外部数据库。                                                                                                                 |
| GitHub Pages                     | 静态网站托管，不能直接运行本项目的 Node 接口和 SQLite。                                                                                                                                      |

Sealos App Deploy / DevBox 也可作为候选：官方文档说明单容器应用、平台公开地址、持久卷，以及 DevBox 构建 OCI 镜像后发布到 App Deploy 的流程。本次文档和控制台入口请求成功；仍需用户登录，确认区域、资源报价和大陆网络访问。

国内控制台入口是 [cloud.sealos.run](https://cloud.sealos.run/)，目前可转到杭州区登录。根据 [Sealos 国内服务条款](https://sealos.cn/legal/terms-of-service)，大陆区域需本人实名认证；系统自动分配的域名用于开发、调试和临时访问，不应视为长期生产入口。长期使用自定义公网域名时需按平台和接入商要求办理 ICP 及接入备案。可先在试用额度内发布临时验收站，再决定正式域名；试用额度、有效期和资源费用以登录后的控制台为准。

平台存在不等于已经部署成功；能从某一台设备访问，也不能证明所有中国大陆网络都可访问。最终交付公开地址后，应在用户实际使用的大陆网络验证首页、接口、收藏刷新恢复、分享快照和 HTTPS。

## 方案一：导入仓库到 Docker 托管平台

1. 用户登录选定的平台，授权导入项目 GitHub 仓库。
2. 创建 Docker Web 服务，使用根目录 `Dockerfile`。镜像内已安装 Node.js 24，平台无需通过 Node 版本自动识别。
3. 挂载一个**持久数据卷**到 `/app/.data`，使容器用户 `node`（UID 1000）有读写权限。设置 `DB_PATH=/app/.data/parallel.sqlite`，保持一个应用实例。
4. 平台将服务映射到容器端口 `3000`；镜像也会读取平台注入的 `PORT`。应用监听 `0.0.0.0`。健康检查路径为 `/api/routes`。
5. 平台分配公开 HTTPS 地址后，设置 `APP_ORIGIN` 为实际地址，例如 `https://your-assigned-host.example`，不包含页面路径。自定义域名可选。
6. 部署并实际验证。重启或重新部署应用后，收藏和分享必须仍然存在，才算数据卷配置成功。

`render.yaml` 是以上结构的一份 Render 蓝图，可从平台的 Blueprint / Git 仓库导入入口使用。其 `starter` 计算规格和数据卷可能收费；创建前检查控制台报价。该蓝图不创建账号、不自动购买资源、不承诺区域或域名在大陆可达。本地环境没有 Docker，因此尚未实际构建或运行容器镜像。

Sealos 可使用 DevBox 将仓库代码构建为 OCI 镜像，再在 App Deploy 部署；也可以部署已经发布的容器镜像。配置一个固定实例、容器端口 `3000`、公开访问、数据卷 `/app/.data` 以及实际分配域名对应的 `APP_ORIGIN`。该平台官方持久存储文档要求同时验证重启和重新部署后数据仍保留；请使用同样标准验收。Node.js 版本由本项目 Dockerfile 固定为 24，若使用 DevBox 自带运行时，应先确认其 Node 版本再构建。

容器首次健康检查会初始化数据库和种子内容。替换镜像会更新策展资料，不会清空同一持久卷中的用户记录。不要把私人数据库提交到仓库或打包进镜像。

### 使用 GitHub Actions 构建镜像

仓库的 `Container` 工作流在 `main` 推送或手动触发时构建 Linux 镜像，先启动实际容器验证接口、匿名会话、收藏所有权、分享快照，以及容器重启和替换后的持久化。只有验证成功，才使用该次任务的 `GITHUB_TOKEN` 登录 GitHub Container Registry 并推送：

```text
ghcr.io/sep1stz/along-a-parallel:latest
ghcr.io/sep1stz/along-a-parallel:sha-完整提交SHA
```

工作流只申请仓库读取和 `packages:write`，不需要在仓库另存长期注册表密码或把令牌填入应用。镜像标签、源仓库和提交号一起记录；验收时优先使用与成功任务对应的 SHA 标签，避免后续 `latest` 更新改变部署版本。构建和验证是否已通过，应查看实际 Actions 任务结果，不能仅凭工作流文件存在判断。

GHCR 新建包可能默认为私有。即使源仓库公开，也必须在 GitHub 的包设置中确认镜像包是 **Public**，然后验证未登录状态可以拉取；完成前不能假定 Sealos 可以匿名下载。不要向 Sealos 提交个人 GitHub 令牌来替代公开镜像设置。GHCR 在部署区域的拉取速度、平台余额与实例报价也应在实际部署时核实。

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
- [Render 数据盘文档](https://render.com/docs/disks)、[区域](https://render.com/docs/regions) 与 [定价](https://render.com/pricing)：本次直接请求超时，蓝图尚未通过平台实际创建验证；费用、区域与资源可用性必须在控制台再次核实。

此指南描述部署方法，不作为已经上线的证明。公开地址和验证结果应以实际部署记录为准。
