# 全球目录的离线构建

运行网站不需要执行导入命令：已经生成的 `src/data/catalog-data.json` 随源码发布。此工具用于维护者重建、检查或更新数据，要求 Node.js 24，无第三方导入依赖。

```sh
node scripts/import-catalog.mjs
node scripts/import-catalog.mjs --offline
```

首次执行会从 GeoNames 官方下载 `cities15000.zip`、`alternateNamesV2.zip`、`countryInfo.txt`、`admin1CodesASCII.txt` 和字段说明。完整中文语言表约 196 MiB；工具分段下载并流式读取 ZIP，避免把其全部解压内容同时放进内存。源文件缓存在项目 `.data/catalog-source/2026-11-11/`，受 `.gitignore` 排除。此目录与应用的 SQLite 数据文件相互独立，导入脚本不会读写用户收藏或旅程。

`--offline` 禁止联网，缺少缓存会报错。`catalog-report.json` 保存实际源文件 SHA-256；缓存与已固定快照不一致会失败。GeoNames 的下载 URL 每天更新，维护者在新机器上可能无法再次下载旧日的相同原始快照；可以使用保存的原始缓存重建，或直接运行仓库已经生成的精简数据。需要更新到新源文件时显式运行 `--refresh`，同时更新脚本中的快照日期、审查新报告、数据许可、精选去重及字体覆盖，并将新的精简数据与报告一起提交。

`--base-only` 仅供开发时在大别名表尚未下载完成前生成过渡目录，其报告会明确包含 `chineseEnrichmentComplete: false` 和 `names-pending` 版本。正式发布前必须重新执行完整导入，并检查该标记为 `true`。

输出文件：

- `catalog-data.json`：有列定义的紧凑数组。每行保留稳定 ID、GeoNames ID、显示名、来源原名、国家/地区代码、WGS84 坐标、IANA 时区、行政区、来源点位海拔、搜索别名、修改日期与名称语言。未知海拔使用 `null`。
- `catalog-report.json`：来源 URL、实际大小、哈希、校验计数、中文名覆盖情况、旧 16 城对应关系，以及 -90° 至 90° 共 181 个整数中心纬度的 ±2° 覆盖表。覆盖统计仅描述该选择性名录。

`src/data/catalog.ts` 将目录与旧 16 城及 `curated-v2.ts` 的精选内容合并。固定 GeoNames ID 优先去重，旧公开城市 ID 保持有效；只有有名称支持、距离合理的情况才进行备用匹配。精选记录保留编辑时使用的城市代表坐标。目录模块只在服务端消费，浏览器应请求分页列表、有限数量地图点或单个详情。

中文名来自明确带中文语言标签的当前别名，不能根据汉字形状猜测语种；原名回退不进行机器翻译。基础目录不生成饮食、日常或建筑故事。别名用于检索，可能包含转写与非首选拼写；不能当成全部为官方名称。城市人口缺乏逐条统计年份，因此未公开展示。海拔只采用来源的明确 `elevation`，不使用 `dem` 替代。

GeoNames 数据独立适用 **CC BY 4.0**，需要保留署名和处理说明，详见根目录 `SOURCES.md` 与 `assets-manifest.json`。代码和原创资料插画继续适用项目 MIT 许可。
