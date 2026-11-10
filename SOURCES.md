# 内容、地理数据与素材来源

整理日期：2026-11-10。产品展示静态策展内容，不将地理、餐饮或文化描述标为实时数据。

## 如何理解核验状态

- `verified`：在本次制作中实际获取了链接页面，并检查了记录的基本事实范围。它不等于机构对本站全文的背书，也不代表已经完成学术意义的同行审校。
- `pending`：提供了对应参考线索，但此次访问遇到 403、限流或超时，无法实际完成核验。保留标记，供后续人工审校；不伪造引文。
- 每条来源在 `src/data/places.ts` 中记录标题、机构、URL、访问日期、对应事实范围与状态。访问结果和事实审校笔记留在 `src/data/source-verification.json`，仅用于审校记录，不作为城市叙事正文。
- 本版叙事以原创中文表述，着重具体地点和可观察场景。避免文化排名、未核实的精确统计与“环境决定文化”的推断。仍待核验的细节不应作为专业旅行、安全或历史研究依据。

本次共有 16 座城市、64 个主题段落，每城至少列出两项参考来源；33 项来源记录已通过实际页面访问与基本范围检查，其余保留为待核验。UNESCO World Heritage Centre、Britannica、部分官方旅游站与 Wikimedia 页面受到反自动访问限制。16 座城市现在均有至少一项实际访问并检查的来源。首版如用于正式出版，仍应继续完成人工核验；标为待核验的页面保留其状态。

## 地图

使用 [Natural Earth](https://www.naturalearthdata.com/) **v5.1.2、1:110m Admin 0 — Countries**。

- 原始文件：[ne_110m_admin_0_countries.geojson](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson)
- 本地文件：`public/maps/world.json`，177 个要素，约 252 KB。
- 修改：保留原几何和坐标，仅将属性缩减为显示名称；保留外环顺时针方向，适配 D3 球面投影。未将城市吸附到纬线上。
- 许可：**Public domain**；参见 [Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)。图示边界仅提供地理背景，不表达对主权或争议边界的立场。
- 完整文件来源、版本、大小与 SHA-256 记录在 `assets-manifest.json`。

城市坐标是用于叙事浏览的近似城市中心，不是行政区边界或用户定位。北纬 30°八座城市采用需求提供的近似中心点，与列出的城市百科地理条目对应；其余采用常见城市中心坐标。数据库按 `abs(city.latitude - centreLatitude) <= band` 查询。±2°是纬度度数，不是公里半径。

## 城市事实范围

| 城市         | 主要参考与范围                                                                                | 此次检查情况                                             |
| ------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 杭州         | UNESCO 西湖文化景观、大运河；Wikipedia 城市条目；Wikivoyage 的西湖、龙井与运河                | 城市百科及旅行指南已访问；UNESCO 待核验                  |
| 成都         | 武侯祠博物馆官方简介、Lonely Planet 城市指南；UNESCO、Wikipedia、Britannica                   | 博物馆与旅行出版社已访问；其余待核验                     |
| 拉萨         | 布达拉宫管理处官方简介、Lonely Planet 城市指南；UNESCO、Wikipedia、Britannica                 | 管理处与旅行出版社已访问；其余待核验                     |
| 设拉子       | UNESCO 波斯园林；Wikipedia 城市条目；Wikivoyage 的法鲁德与巴扎                                | 城市百科及旅行指南已访问；UNESCO、Britannica 待核验      |
| 开罗         | UNESCO 历史开罗；Wikipedia 城市条目；Wikivoyage 的库沙里、富尔与汗哈利利                      | 城市百科及旅行指南已访问；UNESCO、Britannica 待核验      |
| 马拉喀什     | UNESCO 麦地那、杰马夫纳文化空间；Wikipedia 城市条目                                           | 城市百科已访问；UNESCO 待核验                            |
| 新奥尔良     | 美国国家公园局爵士历史；旅游局法国区；Wikivoyage 的 gumbo                                     | 国家公园局与旅行指南已访问；旅游局待核验                 |
| 休斯敦       | Buffalo Bayou Partnership 河湾公园；Visit Houston；Wikipedia、Wikivoyage                      | 公园机构与旅行指南已访问；百科及旅游局待核验             |
| 哈尔滨       | China Daily 政府资讯门户的中央大街、圣索菲亚、太阳岛、红肠与大列巴专题；Wikipedia、Britannica | 五篇具体现地专题已访问，叙事收敛到其支持范围；百科待核验 |
| 威尼斯       | 威尼斯市立博物馆基金会总督宫建筑史、Lonely Planet 城市指南；UNESCO、Wikipedia                 | 博物馆机构与旅行出版社已访问；其余待核验                 |
| 蒙特利尔     | Tourisme Montréal 的 Mile End；Wikipedia、Britannica 的河岛、皇家山与城市史                   | 官方旅游局与城市百科已访问；Britannica 待核验            |
| 波特兰       | Travel Portland 餐车；Wikipedia 城市条目；Wikivoyage 河流、Tilikum Crossing 与餐车            | 旅行指南已访问；旅游局及百科待核验                       |
| 里约热内卢   | UNESCO 山海文化景观；Wikipedia 城市条目；Wikivoyage 海湾、海滨与 feijoada                     | 旅行指南已访问；UNESCO 及百科待核验                      |
| 圣保罗       | MASP 官方介绍；Britannica、Wikipedia 城市条目；Wikivoyage 的街区、公园                        | 博物馆与旅行指南已访问；百科待核验                       |
| 安托法加斯塔 | Wikipedia 城市及 La Portada；Britannica；Wikivoyage 海蚀拱与工业遗产                          | 两个百科条目与旅行指南已访问；Britannica 待核验          |
| 爱丽斯泉     | Tourism Northern Territory；北领地政府电报站公园；Wikipedia 城市条目                          | 官方旅游机构与城市百科已访问；政府公园页待核验           |

官方博物馆页面用于其建筑与馆史范围；Lonely Planet 是商业旅行出版社，China Daily 政府资讯门户是国家媒体发布的地区介绍，均不等同于学术审校。Wikimedia 页面是社区编辑的参考入口，内容可能变化，应进一步追溯其脚注；旅游机构的介绍亦有推广目的。站内不复制原页面长段文字、价格、营业时间或活动日历。

时区采用 IANA 标识：`Asia/Shanghai`、`Asia/Tehran`、`Africa/Cairo`、`Africa/Casablanca`、`America/Chicago`、`Europe/Rome`、`America/Toronto`、`America/Los_Angeles`、`America/Sao_Paulo`、`America/Santiago`、`Australia/Darwin`。本地时钟以运行环境的 `Intl.DateTimeFormat` 和当前时刻计算，尊重该环境的时区数据库与夏令时规则。参考 [IANA Time Zone Database](https://www.iana.org/time-zones)。

## 原创插画与授权

16 座城市均使用本项目制作的原创 SVG 示意插画，文件在 `public/art/`，没有第三方摄影素材或热链依赖。每张 SVG 包含“原创示意插画”的可访问标题与说明。

插画将有辨识度的山体、水系和建筑元素组合为叙事画面，**不是实景照片，不对应精确观景机位，也不是建筑测绘**。例如开罗插画中的尼罗河、清真寺与远处金字塔是示意组合；不能据此推断其实际相对距离。插画、原创中文叙事及项目代码依照仓库 `LICENSE` 发布；Natural Earth 数据单独适用公有领域许可。

素材清单记录每个文件的作者、用途、许可、本地路径、尺寸与哈希。字体使用系统本地衬线与无衬线字体栈，不请求外部字体服务。

## 新增或修订内容

1. 在 `src/data/places.ts` 添加城市，保留真实坐标、IANA 时区与四个主题段落。
2. 为每项新事实添加范围明确的来源；实际打开并审阅后才设为 `verified`。不要仅凭 HTTP 200 或搜索摘要声称整段已核验。
3. 使用原创 SVG，或取得有明确授权的照片后本地保存，并补齐 `assets-manifest.json`；照片需记录作者、源链接与许可证。
4. 叙事围绕具体街区、机构、食物与案例，不泛化为所有居民的共同习惯。
5. 更新相关路线顺序、核验记录与素材哈希；种子导入应保留用户数据。
