# 验证记录

日期：2026-11-10。以下区分本轮实测、历史记录、真实容器检查与镜像发布状态。

## 本轮验证：界面与本地字体更新后

| 检查                      | 状态                 | 实测范围                                                                                                                                                            |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单元测试                  | 通过，16/16          | 地理与 URL 8 项，后端 8 项；涵盖纬度带边界、经度归一化、日期变更线最短旋转、合法与非法 URL、收藏唯一性、会话所有权、SQLite 持久化、分享快照隔离、输入校验与同源防护 |
| TypeScript                | 通过                 | 类型检查通过                                                                                                                                                        |
| ESLint                    | 通过                 | 静态检查通过                                                                                                                                                        |
| 生产构建                  | 通过                 | Next.js 生产构建成功                                                                                                                                                |
| 生产浏览器测试            | 通过，11/11，21.8 秒 | 在生产服务上使用系统 Chrome 实际执行 Playwright 核心流程                                                                                                            |
| 本地字体                  | 通过                 | 浏览器确认 `Parallel Sans SC` 已加载并用于正文与标题；字体从项目本地 `/fonts/noto-sans-sc-latin-cjk.woff2` 提供                                                     |
| 1440 / 1024 / 390 布局    | 通过                 | 三种宽度均无页面横向溢出，对话框位于视口内；逐座检查全部 16 城市在 390px 下的预览、四主题故事及至少两项来源                                                         |
| 运行期外部网络依赖        | 核心流程通过         | 浏览器测试阻止第三方网络请求，本地地图、字体、插画、故事和应用接口仍可使用；本机服务保持运行                                                                        |
| Docker 镜像与容器真实运行 | 通过，GitHub Actions | 任务 42824748311 实际完成生产镜像构建，以及容器启动、接口、会话、收藏所有权、分享快照、重启和替换后的数据卷持久化检查；镜像发布另行记录                             |

浏览器测试覆盖：收藏与刷新恢复、四主题故事、两城比较与第三城替换、公开只读分享、另一匿名会话的私人数据隔离、分享快照不随私人修改变化、城市直链、前进后退、方向键、鼠标拖动和标记点击、背面标记裁切、空纬度带恢复，以及从空纬度带打开比较城市故事后的上一站与下一站。

失败场景通过拦截真实前端写请求并返回 503 注入。测试断言收藏乐观更新回滚、明确错误提示、旅程写入失败时数据库保持原状态，以及恢复接口后重试保存成功。核心流程同时断言没有浏览器控制台错误或未捕获的页面错误，并检查默认动效、减少动效偏好、对话框获得焦点及 Escape 关闭后的焦点恢复。

检查入口：

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

本机浏览器测试使用已有系统 Chrome：

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
node node_modules/@playwright/test/cli.js test
```

本轮截图：[桌面首页](screenshots/desktop.png)、[手机首页](screenshots/mobile.png)、[两城比较](screenshots/comparison.png)。

## 历史记录：生产服务完整重启

此前构建 `dpd7J3El3k_CZeTz1btIw` 曾在独立端口和临时 SQLite 数据库上完成真实 HTTP 验证：收藏、旅程和公开快照在完整停止并重新启动 `next start` 进程后保留；另一随机 Cookie 会话保持隔离；之后修改原收藏与旅程，公开快照保持不变。公开接口不设置匿名 Cookie，也不返回会话标识，测试服务随后停止。

以上属于本轮字体与界面改版前的历史进程重启证据。本轮重新执行的单元测试与生产浏览器结果列于上表。

## 实测：Docker 镜像与数据卷

[Container 任务 42824748311](https://github.com/Sep1stZ/along-a-parallel/actions/runs/42824748311) 已在 GitHub Actions Ubuntu 环境实际构建 Docker 生产镜像并执行 [容器 smoke 脚本](../scripts/smoke-container.mjs)。脚本确认 Node.js 24、非 root 用户、首页与本地地图、16 座城市、匿名会话隔离、收藏唯一性与所有权、HTTPS 规范公开地址对应的 Secure Cookie、同源检查和冻结分享快照。挂载同一命名数据卷后，收藏、旅程与分享快照在容器重启以及删除、替换容器后仍然保留。日志中的三组 PASS 均已核对。

该任务的 **GHCR 发布步骤失败**：数据层上传完成后，manifest 提交返回 `denied`。匿名读取确认，公开包中只有构建证明（attestation）manifest，`os` 和 `architecture` 均为 `unknown`，没有可执行启动命令；应用 manifest 和总 image index 均返回 404。因此本次不能宣称镜像已经可以从注册表拉取部署，也不能使用构建证明的 digest 作为应用镜像。

任务日志显示 BuildKit 默认生成 provenance attestation 和 image index。Docker 官方文档说明这些证明默认生成，且 containerd image store 支持保留 image index。已准备最小诊断修复：构建显式加入 `--provenance=false --sbom=false`，保留源仓库与提交标签，并继续先执行容器 smoke 再发布。CLI 官方文档确认 `docker build` 是该构建命令的别名，两项参数均支持 `false`。修复后的工作流尚需重新运行，不能据此断言通用 `denied` 的唯一根因已查明。

参考：[Docker build CLI](https://github.com/docker/buildx/blob/master/docs/reference/buildx_build.md)、[默认构建证明](https://github.com/docker/docs/blob/main/content/manuals/build/metadata/attestations/_index.md)、[Docker Engine containerd image store](https://github.com/docker/docs/blob/main/content/manuals/engine/storage/containerd.md)。公开托管站还需独立验证实际拉取、启动、持久卷、HTTPS 和大陆网络访问。

## 产品与部署边界

- 内容为 16 座城市的静态策展条目，来源范围与状态见 `SOURCES.md`；插画为原创示意。
- 匿名旅程绑定浏览器 Cookie，没有账户登录或跨设备私密同步。
- 中文和拉丁文字使用本地字体；阿拉伯文、藏文等原名使用系统字体回退。
- SQLite 需要可写的持久磁盘，当前运行方式面向单实例 Node 服务。
- GitHub 开源仓库发布与公网网站托管分别验证。
