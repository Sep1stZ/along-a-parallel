# 内容、地理数据与素材来源

整理日期：2026-11-13。产品展示静态地点资料与策展内容，不将地理、餐饮或文化描述标为实时数据。

## V2.1 城市速读与地理档案

全部 34,214 个地点现有地理档案，包括可读行政区、纬度分区、时区说明、已收录点位海拔、地名别名、三个附近地点与三个精选阅读入口。附近点位按球面直线距离排序，不表示道路距离或现实通行条件。2,764 个已用一级行政区中有 1,934 个提供了中文标签，来自固定 GeoNames 快照，其余保留上游名称；此加工数据仍适用 CC BY 4.0。

165 座城市增加中文百科速读，其中中国大陆 59 篇、香港 1 篇、台湾 3 篇，其他地区 102 篇。导言经 Wikimedia 官方 Core API 实际获取后逐篇审读、按 GeoNames ID 核对对象，保留固定修订链接、原始响应 SHA-256、读取日期、署名、许可与具体摘编范围。它们与 60 城原创四主题手记有重叠，不应将两个数字相加作为不同城市数。

`src/data/city-articles.json` 及相应审读白名单中的百科节选、删节与文字整理独立适用 **CC BY-SA 4.0**，作者为对应修订中的 Wikipedia contributors；原始修订及文章历史可追溯原作者。项目进行了简体中文整理、删除脚注和读音、缩短篇幅，并删去部分无一致口径的即时数字、榜单及泛化描述；这些改编继续采用同一许可，不改为项目 MIT。每篇在预览、阅读、比较和新建分享快照中保留来源入口及许可。

详细流程与适用范围见 [CITY-ARTICLES.md](docs/CITY-ARTICLES.md) 及其中逐篇审读记录。百科自身引文没有被逐一独立复核，不把 HTTP 成功或标题存在等同于事实审校。旧城市与自然观察中仍待核验的来源继续保留原标记。

## V2 全球基础地点目录

全球目录来自 [GeoNames cities15000](https://download.geonames.org/export/dump/cities15000.zip)，此次实际读取 **34,214** 条聚落记录，覆盖 **244 个国家或地区代码**。这是上游按人口或行政地位选择的名录，不是地球上全部城市、村落或居民点的清单。不能将未收录解释为没有居民，也不能保证每一条纬线都有城市。

- 快照整理日期：**2026-11-11**。原始来源、字节数、SHA-256、拒绝计数、时区检查及 181 个整数纬度中心的 ±2° 覆盖统计见 `src/data/catalog-report.json`。`src/data/catalog.ts` 的运行期报告另外计算加入精选内容并去重后的覆盖情况。
- 本地文件：`src/data/catalog-data.json`。为减少体积，数据采用带 `columns` 的紧凑数组；`src/data/catalog.ts` 负责映射为应用对象，仅在服务端使用。
- **数据许可为 CC BY 4.0**，作者为 GeoNames contributors；[许可原文](https://creativecommons.org/licenses/by/4.0/)，[字段与许可说明](https://download.geonames.org/export/dump/readme.txt)。这部分第三方数据不改授项目 MIT 许可。署名：Contains GeoNames geographical data, © GeoNames contributors, CC BY 4.0；Along a Parallel 进行了字段筛选、名称选择、旧城市 ID 映射和紧凑格式转换。
- 城市与聚落采用 WGS84 点位，经纬度是名录代表位置，不是行政边界、房屋位置或实地定位。旧 16 城仍保留首版坐标与公开 ID，通过固定 GeoNames ID 去除目录中的重复点；精选城市中心与名录中心可能有小幅差异。
- 时区直接使用名录的 IANA 标识，并通过当前 Node.js 的 `Intl.DateTimeFormat` 实际校验；本批全部 34,214 条有可用时区。显示当地时间时使用当前时间与 IANA 规则，不使用下载表中的固定 UTC 偏移。
- 中文显示名仅采用 `alternateNamesV2` 中带中文语言标记、未标为历史或俗称、没有结束日期的名称，或已人工编辑的精选中文名称。优先简体中文变体；缺少可靠中文别名时保留来源原名，不能声称中文覆盖完整。搜索别名保留来源转写及其他拼写，搜索用别名不等于当前官方名称。
- 行政区名称来自 `admin1CodesASCII.txt`，国家或地区显示名通过运行环境的 `Intl.DisplayNames('zh-Hans')` 本地化。行政归属是该数据源的记录口径，不能据此推断主权立场。
- **4,495** 条记录带有原始 `elevation` 字段，仅将其作为点位海拔（米）。不把 DEM 栅格平均高度填作城市海拔，也不填补未知高度。人口字段因缺少每条统计对应年份，未进入产品展示。
- 基础卡片只提供名称、定位、行政区与时区等资料，`stories` 为空；文化内容比较不为它们补写虚构段落。共用的 `public/art/catalog.svg` 是抽象经纬网与地形线示意，**不是对应城市的实景或地形图**。

离线构建：`node scripts/import-catalog.mjs --offline` 从 `.data/catalog-source/2026-11-11/` 的缓存重建，并核对已记录的源文件哈希；不接触收藏、匿名会话或私人数据库。首次获取源数据可以联网执行 `node scripts/import-catalog.mjs`。上游下载地址是每日更新的文件，不是永久不变的历史版本；哈希变化时脚本拒绝悄悄替换旧快照。需要明确更新时使用 `--refresh` 并审查报告。原始 ZIP 缓存不提交 Git，已经生成的精简目录随项目发布，普通运行无需下载数据或调用外部地名服务。更多说明见 `scripts/import-catalog.README.md`。

V2 精选故事在 `src/data/curated-v2.ts`，自然地理观察在 `src/data/observations.ts`，分别记录具体事实范围、资料链接与核验状态。海洋、沙漠、岛屿与极地观察不是城市数据；研究站、非永久聚落与无人区不能混称为城市。未逐条完成的事实检查应保持 `pending`，数据下载成功不能替代故事审校。

## 如何理解核验状态

- `verified`：在本次制作中实际获取了链接页面，并检查了记录的基本事实范围。它不等于机构对本站全文的背书，也不代表已经完成学术意义的同行审校。
- `pending`：提供了对应参考线索，但此次访问遇到 403、限流或超时，无法实际完成核验。保留标记，供后续人工审校；不伪造引文。
- 每条来源在 `src/data/places.ts` 中记录标题、机构、URL、访问日期、对应事实范围与状态。访问结果和事实审校笔记留在 `src/data/source-verification.json`，仅用于审校记录，不作为城市叙事正文。
- 本版叙事以原创中文表述，着重具体地点和可观察场景。避免文化排名、未核实的精确统计与“环境决定文化”的推断。仍待核验的细节不应作为专业旅行、安全或历史研究依据。

首版审校基线（2026-11-10）共有 16 座城市、64 个主题段落，每城至少列出两项参考来源；33 项来源记录已通过实际页面访问与基本范围检查，其余保留为待核验。UNESCO World Heritage Centre、Britannica、部分官方旅游站与 Wikimedia 页面受到反自动访问限制。16 座城市均有至少一项实际访问并检查的来源。首版如用于正式出版，仍应继续完成人工核验；标为待核验的页面保留其状态。V2 新增内容的核验情况应以其各条来源为准，不沿用这组首版数量。

V2 于 2026-11-11 逐项复查首版 31 条待核验来源，其中 12 条成功取得正文并审阅指定范围，19 条仍返回 HTTP 403。首版 64 项来源当前为 **45 项已核验、19 项待核验**；没有以 HTTP 200 代替事实审阅。新的范围已更新到城市来源，明细见 [首版来源复查记录](docs/CONTENT-V2-LEGACY.md) 及 `source-verification.json` 的 `v2Recheck`。下表的此次检查情况已包含这轮复查。

## 地图

使用 [Natural Earth](https://www.naturalearthdata.com/) **v5.1.2、1:110m Admin 0 — Countries**。

- 原始文件：[ne_110m_admin_0_countries.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson)
- 本地文件：`public/maps/world.json`，177 个要素，约 252 KB。
- 修改：保留原几何和坐标，仅将属性缩减为显示名称；保留外环顺时针方向，适配 D3 球面投影。未将城市吸附到纬线上。
- 许可：**Public domain**；参见 [Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)。图示边界仅提供地理背景，不表达对主权或争议边界的立场。
- 完整文件来源、版本、大小与 SHA-256 记录在 `assets-manifest.json`。

城市坐标是用于叙事浏览的近似城市中心，不是行政区边界或用户定位。北纬 30°八座城市采用需求提供的近似中心点，与列出的城市百科地理条目对应；其余采用常见城市中心坐标。数据库按 `abs(city.latitude - centreLatitude) <= band` 查询。±2°是纬度度数，不是公里半径。

## 城市事实范围

| 城市         | 主要参考与范围                                                                                | 此次检查情况                                                  |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 杭州         | UNESCO 西湖文化景观、大运河；Wikipedia 城市条目；Wikivoyage 的西湖、龙井与运河                | 城市百科及旅行指南已访问；UNESCO 待核验                       |
| 成都         | 武侯祠博物馆官方简介、Lonely Planet 城市指南；UNESCO、Wikipedia、Britannica                   | 博物馆、旅行出版社与城市百科已访问；UNESCO、Britannica 待核验 |
| 拉萨         | 布达拉宫管理处官方简介、Lonely Planet 城市指南；UNESCO、Wikipedia、Britannica                 | 管理处、旅行出版社与城市百科已访问；UNESCO、Britannica 待核验 |
| 设拉子       | UNESCO 波斯园林；Wikipedia 城市条目；Wikivoyage 的法鲁德与巴扎                                | 城市百科及旅行指南已访问；UNESCO、Britannica 待核验           |
| 开罗         | UNESCO 历史开罗；Wikipedia 城市条目；Wikivoyage 的库沙里、富尔与汗哈利利                      | 城市百科及旅行指南已访问；UNESCO、Britannica 待核验           |
| 马拉喀什     | UNESCO 麦地那、杰马夫纳文化空间；Wikipedia 城市条目                                           | 城市百科与 UNESCO 非遗页已访问；麦地那世界遗产页待核验        |
| 新奥尔良     | 美国国家公园局爵士历史；旅游局法国区；Wikipedia、Wikivoyage 的城市与饮食资料                  | 国家公园局、旅游局、城市百科与旅行指南指定范围已访问          |
| 休斯敦       | Buffalo Bayou Partnership 河湾公园；Visit Houston；Wikipedia、Wikivoyage                      | 公园机构、旅游局、城市百科与旅行指南指定范围已访问            |
| 哈尔滨       | China Daily 政府资讯门户的中央大街、圣索菲亚、太阳岛、红肠与大列巴专题；Wikipedia、Britannica | 五篇具体现地专题与城市百科已访问；Britannica 待核验           |
| 威尼斯       | 威尼斯市立博物馆基金会总督宫建筑史、Lonely Planet 城市指南；UNESCO、Wikipedia                 | 博物馆、旅行出版社与城市百科已访问；UNESCO 待核验             |
| 蒙特利尔     | Tourisme Montréal 的 Mile End；Wikipedia、Britannica 的河岛、皇家山与城市史                   | 官方旅游局与城市百科已访问；Britannica 待核验                 |
| 波特兰       | Travel Portland 餐车；Wikipedia 城市条目；Wikivoyage 河流、Tilikum Crossing 与餐车            | 城市百科与旅行指南已访问；旅游局待核验                        |
| 里约热内卢   | UNESCO 山海文化景观；Wikipedia 城市条目；Wikivoyage 海湾、海滨与 feijoada                     | 城市百科与旅行指南已访问；UNESCO 待核验                       |
| 圣保罗       | MASP 官方介绍；Britannica、Wikipedia 城市条目；Wikivoyage 的街区、公园                        | 博物馆、城市百科与旅行指南已访问；Britannica 待核验           |
| 安托法加斯塔 | Wikipedia 城市及 La Portada；Britannica；Wikivoyage 海蚀拱与工业遗产                          | 两个百科条目与旅行指南已访问；Britannica 待核验               |
| 爱丽斯泉     | Tourism Northern Territory；北领地政府电报站公园；Wikipedia 城市条目                          | 官方旅游机构与城市百科已访问；政府公园页待核验                |

官方博物馆页面用于其建筑与馆史范围；Lonely Planet 是商业旅行出版社，China Daily 政府资讯门户是国家媒体发布的地区介绍，均不等同于学术审校。Wikimedia 页面是社区编辑的参考入口，内容可能变化，应进一步追溯其脚注；旅游机构的介绍亦有推广目的。站内不复制原页面长段文字、价格、营业时间或活动日历。

时区采用 IANA 标识：`Asia/Shanghai`、`Asia/Tehran`、`Africa/Cairo`、`Africa/Casablanca`、`America/Chicago`、`Europe/Rome`、`America/Toronto`、`America/Los_Angeles`、`America/Sao_Paulo`、`America/Santiago`、`Australia/Darwin`。本地时钟以运行环境的 `Intl.DateTimeFormat` 和当前时刻计算，尊重该环境的时区数据库与夏令时规则。参考 [IANA Time Zone Database](https://www.iana.org/time-zones)。

## 原创插画与授权

首版 16 座城市均使用本项目制作的原创 SVG 示意插画，V2 新增精选城市的插画亦放在 `public/art/`。没有第三方摄影素材或热链依赖。插画以可访问标题与说明标注示意性质，具体文件及授权见素材清单。

插画将有辨识度的山体、水系和建筑元素组合为叙事画面，**不是实景照片，不对应精确观景机位，也不是建筑测绘**。例如开罗插画中的尼罗河、清真寺与远处金字塔是示意组合；不能据此推断其实际相对距离。插画、原创中文叙事及项目代码依照仓库 `LICENSE` 发布；Natural Earth 数据单独适用公有领域许可。

素材清单记录每个文件的作者、用途、许可、本地路径、尺寸与哈希。主要中文界面使用本地自托管的 Noto Sans SC 子集，另保留系统字体回退，不请求外部字体服务。

## 本地中文字体

界面字体 **Parallel Sans SC** 基于 Google Fonts 官方仓库的 **Noto Sans SC 2.004-H2** 制作字形子集。它是重新命名的项目子集，不是完整 Noto 字库。

- 上游：[Google Fonts / ofl/notosanssc](https://github.com/google/fonts/tree/main/ofl/notosanssc)
- 字体来源：[NotoSansSC[wght].ttf](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf)
- 原作者：Adobe 及 Noto 项目贡献者；上游版权声明保留于字体名称记录与本地许可证文件。
- 许可：**SIL Open Font License 1.1**，原文保存在 `public/fonts/OFL-NotoSansSC.txt`；[许可原文来源](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt)。字体单独适用 OFL，不改为项目 MIT 许可。
- 本地文件：`public/fonts/noto-sans-sc-latin-cjk.woff2`，837,616 字节，变量字重 **400–700**。
- 修改：以 fontTools 4.68.0 和 Brotli 1.2.1 对完整全球目录、当前 `src/`、界面和精选手记的字符、ASCII、拉丁重音字符及标点取子集，保留 3,447 个 Unicode 映射；将字重轴限制为 400–700，并将内部字体家族重新命名为 Parallel Sans SC。未改变字形设计。
- 范围：覆盖制作时站内中文界面与城市叙事；阿拉伯语、藏文与任意新增名称使用系统字体回退。新增中文文案后应检查是否需要扩充子集。
- `public/fonts/subset-info.json` 记录字重轴、字符数量、文件 SHA-256、上游文件 SHA-256 与回退字符。`assets-manifest.json` 记录字体和许可证的来源与许可。

浏览器从本站加载字体，基础阅读不依赖 Google Fonts、海外 CDN 或运行期外部网络。字体可缓存；初次加载期间应保留系统字体回退，避免文字空白。

## 新增或修订内容

1. 在 `src/data/places.ts` 添加城市，保留真实坐标、IANA 时区与四个主题段落。
2. 为每项新事实添加范围明确的来源；实际打开并审阅后才设为 `verified`。不要仅凭 HTTP 200 或搜索摘要声称整段已核验。
3. 使用原创 SVG，或取得有明确授权的照片后本地保存，并补齐 `assets-manifest.json`；照片需记录作者、源链接与许可证。
4. 叙事围绕具体街区、机构、食物与案例，不泛化为所有居民的共同习惯。
5. 更新相关路线顺序、核验记录与素材哈希；种子导入应保留用户数据。
