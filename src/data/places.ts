export type Source = {
  title: string;
  publisher: string;
  url: string;
  accessedAt: string;
  status: 'verified' | 'pending';
  scope: string;
};

export type Story = { theme: string; title: string; body: string };
export type Place = {
  id: string;
  name: string;
  originalName: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  tagline: string;
  intro: string;
  image: string;
  accent: string;
  stories: Story[];
  sources: Source[];
};

const verifiedSourceUrls = new Set<string>([
  'https://en.wikipedia.org/wiki/Hangzhou',
  'https://en.wikipedia.org/wiki/Shiraz',
  'https://en.wikipedia.org/wiki/Cairo',
  'https://en.wikipedia.org/wiki/Marrakesh',
  'https://www.nps.gov/jazz/learn/historyculture/history_early.htm',
  'https://buffalobayou.org/location/buffalo-bayou-park/',
  'https://en.wikipedia.org/wiki/Montreal',
  'https://www.mtl.org/en/experience/mile-end',
  'https://masp.org.br/en/about',
  'https://en.wikipedia.org/wiki/Antofagasta',
  'https://en.wikipedia.org/wiki/La_Portada',
  'https://en.wikipedia.org/wiki/Alice_Springs',
  'https://northernterritory.com/alice-springs-and-surrounds',
  'https://en.wikivoyage.org/wiki/Hangzhou',
  'https://en.wikivoyage.org/wiki/Shiraz',
  'https://en.wikivoyage.org/wiki/Cairo',
  'https://en.wikivoyage.org/wiki/New_Orleans',
  'https://en.wikivoyage.org/wiki/Houston',
  'https://en.wikivoyage.org/wiki/Portland_(Oregon)',
  'https://en.wikivoyage.org/wiki/Rio_de_Janeiro',
  'https://en.wikivoyage.org/wiki/S%C3%A3o_Paulo',
  'https://en.wikivoyage.org/wiki/Antofagasta',
  'https://www.wuhouci.net.cn/about',
  'https://www.lonelyplanet.com/china/sichuan/chengdu',
  'https://www.potalapalace.cn/potala.html',
  'https://www.lonelyplanet.com/china/tibet/lhasa',
  'https://palazzoducale.visitmuve.it/en/building-and-history/',
  'https://www.lonelyplanet.com/italy/venice',
  'https://govt.chinadaily.com.cn/s/201711/24/WS5b784019498e855160e8cb5f/central-avenue.html',
  'https://govt.chinadaily.com.cn/s/201711/24/WS5b784023498e855160e8cb65/st-sophia-church.html',
  'https://govt.chinadaily.com.cn/s/201711/24/WS5b78402e498e855160e8cb6c/the-sun-island-scenic-area.html',
  'https://govt.chinadaily.com.cn/s/201803/16/WS5b78719c498e855160e8e9be/red-sausage-hong-chang-hongchang.html',
  'https://govt.chinadaily.com.cn/s/201803/16/WS5b787192498e855160e8e9b8/great-lieba-bread-da-lie-ba-mian-bao-daliebamianbao.html',
]);

const source = (title: string, publisher: string, url: string, scope: string): Source => ({
  title,
  publisher,
  url,
  scope,
  accessedAt: '2026-11-10',
  status: verifiedSourceUrls.has(url) ? 'verified' : 'pending',
});

/** Curated city-centre coordinates; illustrations are original schematic artwork. */
export const places: Place[] = [
  {
    id: 'hangzhou',
    name: '杭州',
    originalName: 'Hangzhou',
    country: '中国',
    latitude: 30.2741,
    longitude: 120.1551,
    timezone: 'Asia/Shanghai',
    tagline: '把一座城，慢慢读成一幅山水。',
    intro:
      '西湖的堤岸把山、水与街巷连在一起。清晨从湖边走向老城，茶园、运河和市场展开另一种杭州：风景并非城市的背景，而是生活不断经过的地方。',
    image: '/art/hangzhou.svg',
    accent: '#728b79',
    stories: [
      {
        theme: 'geography',
        title: '湖与江之间',
        body: '杭州位于钱塘江下游，西侧丘陵与东侧平原相接。西湖周围的山体、堤岛与水面共同组织了景观。与同纬度附近的拉萨相比，这里的低地水网提供了不同的空间条件；两座城市的生活也各有长久的历史塑造。',
      },
      {
        theme: 'architecture',
        title: '一条堤，也是观看的方式',
        body: '苏堤以桥与堤岸串联湖面，人在行走中不断转换看山、看水的角度。西湖文化景观包含园林、寺塔与传统聚落，既有自然地形，也有历代人的营建。今天湖边的步行空间仍延续着这种人与山水的关系。',
      },
      {
        theme: 'life',
        title: '从湖边走到桥西',
        body: '京杭大运河杭州段的拱宸桥一带，把注意力从西湖带向河岸街区。桥、码头遗迹与沿河民居提示着另一段城市史。沿河散步、进入博物馆，是理解水运怎样参与城市成长的一种具体入口。',
      },
      {
        theme: 'food',
        title: '山坡上的一杯龙井',
        body: '西湖西侧的龙井村、梅家坞等地与茶园相邻，龙井茶因此有了可以步行进入的产地。看茶园时，地形、栽培与制作技艺应放在一起理解；一杯茶的风味不能只由“同一纬度”解释，也与品种、采制和人的经验有关。',
      },
    ],
    sources: [
      source(
        'Hangzhou',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Hangzhou',
        '龙井村与茶园、西湖堤岸、大运河；社区编辑旅行指南',
      ),
      source(
        'West Lake Cultural Landscape of Hangzhou',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/1334/',
        '西湖的堤岸、园林、寺塔及人文景观构成',
      ),
      source(
        'The Grand Canal',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/1443/',
        '大运河与杭州的水运背景',
      ),
      source(
        'Hangzhou',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Hangzhou',
        '城市中心坐标、钱塘江、龙井茶背景；百科性线索',
      ),
    ],
  },
  {
    id: 'chengdu',
    name: '成都',
    originalName: 'Chengdu',
    country: '中国',
    latitude: 30.5728,
    longitude: 104.0668,
    timezone: 'Asia/Shanghai',
    tagline: '竹椅一摆，城市就有了停顿。',
    intro:
      '岷江水系穿过成都平原，公园茶馆和街巷面馆提供了认识城市的细小入口。从人民公园的一张竹椅出发，可以看见水利、商业和公共生活留下的不同层次。',
    image: '/art/chengdu.svg',
    accent: '#8d9a6d',
    stories: [
      {
        theme: 'geography',
        title: '平原里的水路',
        body: '成都位于四川盆地西部的成都平原，岷江及其分流与灌溉网络对区域农业十分重要。都江堰位于城市西北方向，它的分水系统展示了人如何调整河水的流向。这里的湿润平原与杭州的江南水网可以对照，却并非同一种地貌。',
      },
      {
        theme: 'architecture',
        title: '从祠庙读城市',
        body: '成都武侯祠以惠陵、汉昭烈庙与纪念诸葛亮的祠庙形成历史建筑群。刘备殿与诸葛亮殿前后并立的格局，提示纪念对象与建筑秩序之间的联系。今天的博物馆还连接遗迹保护、展览与锦里街区，几种不同用途共同组成这一片城市空间。',
      },
      {
        theme: 'life',
        title: '在茶馆里停一停',
        body: '茶馆是认识成都的一种入口，旅行指南也把延续多代的茶馆经营列为城市线索。选择一间具体茶馆坐下，可以观察座席、茶具与交谈如何组织停留。这样的场景既有经营者的工作，也有顾客各自的目的，并非所有居民共享的一幅固定民俗画。',
      },
      {
        theme: 'food',
        title: '一碗担担面的路程',
        body: '担担面以细面、调味汁和肉臊等构成，不同店家有不同配方。其名称与挑担售卖的叙述相联系，提示食物也跟随街头买卖而传播。花椒与辣椒是川菜的重要线索，但成都的饮食远不止“辣”这一种味觉。',
      },
    ],
    sources: [
      source(
        '武侯祠简介',
        '成都武侯祠博物馆',
        'https://www.wuhouci.net.cn/about',
        '武侯祠、惠陵、汉昭烈庙、前后两殿格局与博物馆的组成',
      ),
      source(
        'Chengdu Travel',
        'Lonely Planet',
        'https://www.lonelyplanet.com/china/sichuan/chengdu',
        '实际城市指南已访问：茶馆文化与餐饮背景；不核验具体店铺或营业信息',
      ),
      source(
        'Mount Qingcheng and the Dujiangyan Irrigation System',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/1001/',
        '都江堰水利与岷江背景',
      ),
      source(
        'Chengdu',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Chengdu',
        '坐标、平原、人民公园、茶馆及城市饮食线索',
      ),
      source(
        'Chengdu',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Chengdu',
        '城市地形、水系与历史背景',
      ),
    ],
  },
  {
    id: 'lhasa',
    name: '拉萨',
    originalName: 'Lhasa · ལྷ་ས',
    country: '中国',
    latitude: 29.6525,
    longitude: 91.1721,
    timezone: 'Asia/Shanghai',
    tagline: '同一条纬线，另一种天空的高度。',
    intro:
      '拉萨河谷里的城市沿山势铺开，布达拉宫的红白墙体成为醒目的地标。八廓街的步行环线、茶馆与院落，让高原的地理条件与具体的城市生活相遇。',
    image: '/art/lhasa.svg',
    accent: '#b88669',
    stories: [
      {
        theme: 'geography',
        title: '高原上的河谷',
        body: '拉萨位于青藏高原的拉萨河谷，河谷为聚落与交通提供了相对平缓的空间。它与杭州纬度接近，但海拔和周边地形明显不同。纬度帮助我们提出比较问题，却不能单独说明两座城市的气候、建筑或文化。',
      },
      {
        theme: 'architecture',
        title: '红山上的层叠墙体',
        body: '布达拉宫依拉萨红山营建，宫堡式建筑群包含宫殿、佛殿与僧舍等不同用途的空间。管理处资料记录了长期扩建与修缮的过程。观察这里时，山地选址、建筑用途与保护实践，都比单纯的外观联想更能解释它的层次。',
      },
      {
        theme: 'life',
        title: '八廓街的环形步道',
        body: '围绕大昭寺的八廓街兼有宗教活动、商贸与步行交通等用途。沿街观看，应尊重当地使用者的节奏与礼仪。这里既是游客到访的街区，也是有人居住、工作和持续维护的城市空间。',
      },
      {
        theme: 'food',
        title: '茶馆里的两种茶',
        body: '拉萨可以遇见甜茶和酥油茶，也有以青稞制成的糌粑。它们属于不同的食材、制作和消费场景。把茶馆作为一个观察入口，比把某种食物概括成所有人的日常更准确；今天的城市同样拥有多样的餐馆与口味。',
      },
    ],
    sources: [
      source(
        '布达拉宫简介',
        '西藏自治区布达拉宫管理处',
        'https://www.potalapalace.cn/potala.html',
        '布达拉宫的红山选址、宫堡式建筑、用途与扩建修缮',
      ),
      source(
        'Lhasa Travel',
        'Lonely Planet',
        'https://www.lonelyplanet.com/china/tibet/lhasa',
        '实际城市指南已访问：红白宫殿外观、大昭寺与八廓环线',
      ),
      source(
        'Historic Ensemble of the Potala Palace, Lhasa',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/707/',
        '布达拉宫、大昭寺、罗布林卡的建筑背景',
      ),
      source(
        'Lhasa',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Lhasa',
        '坐标、拉萨河谷、八廓街与茶馆背景',
      ),
      source(
        'Lhasa',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Lhasa',
        '高原河谷与城市史',
      ),
    ],
  },
  {
    id: 'shiraz',
    name: '设拉子',
    originalName: 'Shiraz · شیراز',
    country: '伊朗',
    latitude: 29.5918,
    longitude: 52.5837,
    timezone: 'Asia/Tehran',
    tagline: '在庭院的阴影里，寻找水与诗。',
    intro:
      '扎格罗斯山地附近的设拉子，以庭院、诗人纪念园和巴扎形成丰富的空间层次。水渠和树荫组织了园林，也让人看见干燥地区的生活如何经过长期设计。',
    image: '/art/shiraz.svg',
    accent: '#a48494',
    stories: [
      {
        theme: 'geography',
        title: '山地之间的城市',
        body: '设拉子位于伊朗西南部的山间平原，邻近扎格罗斯山地。这里与杭州处在相近纬度，却拥有不同的降水与水资源条件。观察城市中的水池和园林，需要同时考虑地形、供水技术以及长期的园林传统。',
      },
      {
        theme: 'architecture',
        title: '把花园分成四个方向',
        body: '埃拉姆花园属于“波斯园林”世界遗产的组成部分。水道、树木与建筑共同形成组织空间的轴线，遮荫也是游园体验的一部分。瓦基尔巴扎的拱顶与连续店铺，则提供了另一种被覆盖的步行空间。',
      },
      {
        theme: 'life',
        title: '诗人的园地',
        body: '哈菲兹墓园和萨迪墓园是设拉子的文化地标。游客在园中停留、阅读与交谈，纪念建筑因此也是被使用的公共场所。这里呈现的是具体地点中的文化实践，不意味着每位居民都以相同方式亲近诗歌。',
      },
      {
        theme: 'food',
        title: '一小碗法鲁德',
        body: '法鲁德是一种以细淀粉丝、糖浆等制作的冰凉甜食，设拉子是它的重要地方关联。玫瑰水与青柠常作为风味线索出现；具体做法随店家而异。把这碗甜食与当地市场、用餐场景放在一起，更能理解食物的地方性。',
      },
    ],
    sources: [
      source(
        'Shiraz',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Shiraz',
        '法鲁德的基本制作、瓦基尔巴扎与花园；社区编辑旅行指南',
      ),
      source(
        'The Persian Garden',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/1372/',
        '埃拉姆花园与波斯园林的空间结构',
      ),
      source(
        'Shiraz',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Shiraz',
        '城市坐标、地形、诗人墓园、瓦基尔巴扎与法鲁德线索',
      ),
      source(
        'Shiraz',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Shiraz',
        '地形与城市文化史',
      ),
    ],
  },
  {
    id: 'cairo',
    name: '开罗',
    originalName: 'Cairo · القاهرة',
    country: '埃及',
    latitude: 30.0444,
    longitude: 31.2357,
    timezone: 'Africa/Cairo',
    tagline: '一条河，把沙漠边缘写成城市。',
    intro:
      '尼罗河穿过开罗，桥梁把两岸的生活连在一起。老城的庭院与宣礼塔、河边的道路和街头豆食摊，呈现一座古老而持续生长的大城市。',
    image: '/art/cairo.svg',
    accent: '#bd956b',
    stories: [
      {
        theme: 'geography',
        title: '尼罗河的两岸',
        body: '开罗位于尼罗河三角洲上游附近，河流与周边干燥地形形成鲜明对照。尼罗河为城市提供重要的水与空间轴线，但城市的发展同样由贸易、政治与基础设施塑造。西侧吉萨的金字塔属于另一处相邻的历史地理空间。',
      },
      {
        theme: 'architecture',
        title: '老城的庭院与塔',
        body: '历史开罗拥有清真寺、宗教学校、浴室与喷泉等多种建筑遗存。沿穆伊兹街步行，可以观察石材立面、门洞和宣礼塔如何共同组织街道景观。它们来自不同年代，不能把“老城”视为一种完全统一的建筑风格。',
      },
      {
        theme: 'life',
        title: '在汗哈利利停留',
        body: '汗哈利利市场及附近街巷是历史商业区的一部分，今天也承接旅游消费。店铺、咖啡馆与宗教建筑的邻接，让步行线路在交易与休息之间切换。理解市场时，应同时看见商人的工作和城市空间的持续变化。',
      },
      {
        theme: 'food',
        title: '一碗库沙里',
        body: '库沙里把米饭、意面、扁豆等食材与番茄酱、炸洋葱组合在一起，是开罗常见餐馆中的一道具体食物。另一条线索是以蚕豆制作的富尔。食物的组合提示迁徙、贸易与城市餐饮经营的作用，不能只从沙漠环境推导口味。',
      },
    ],
    sources: [
      source(
        'Cairo',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Cairo',
        '库沙里、富尔、汗哈利利与尼罗河；社区编辑旅行指南',
      ),
      source(
        'Historic Cairo',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/89/',
        '历史开罗建筑类型与遗产范围',
      ),
      source(
        'Cairo',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Cairo',
        '坐标、尼罗河、汗哈利利与城市餐饮背景',
      ),
      source(
        'Cairo',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Cairo',
        '地形、水系与历史街区',
      ),
    ],
  },
  {
    id: 'marrakesh',
    name: '马拉喀什',
    originalName: 'Marrakech · مراكش',
    country: '摩洛哥',
    latitude: 31.6295,
    longitude: -7.9811,
    timezone: 'Africa/Casablanca',
    tagline: '赭红墙后，有一座安静的庭院。',
    intro:
      '阿特拉斯山脉北侧的马拉喀什，以赭红色墙体和麦地那街巷展开。走过热闹的广场，再进入有水池与树荫的庭院，城市的尺度会突然变得安静。',
    image: '/art/marrakesh.svg',
    accent: '#bb795b',
    stories: [
      {
        theme: 'geography',
        title: '山前平原上的绿意',
        body: '马拉喀什坐落在阿特拉斯山脉北侧的豪兹平原。山地与城市的供水历史密切相关，花园和棕榈林也依赖人的管理。它与同纬度附近的新奥尔良形成有趣对照：两地周边的水文条件不同，城市却都发展出有层次的庭院与街巷。',
      },
      {
        theme: 'architecture',
        title: '向内打开的房子',
        body: '麦地那的城墙、库图比亚清真寺宣礼塔与传统宅院构成不同尺度的地标。常被称作 riad 的住宅围绕内部庭院组织房间，许多现被改为旅宿。今天看到的修复、商业用途与历史结构，需要分别理解。',
      },
      {
        theme: 'life',
        title: '杰马夫纳的时间层次',
        body: '杰马夫纳广场及其周边在一天中呈现不同活动，摊贩、表演与行人共同使用空间。UNESCO 将这里的文化空间列入非物质文化遗产。观看表演或拍照时，尊重表演者与经营者，也能让一次到访更接近真实的交流。',
      },
      {
        theme: 'food',
        title: '陶锅中的两种做法',
        body: '塔吉锅以带锥形盖的陶器焖煮，材料和配方多样；马拉喀什还以 tanjia 这种陶罐慢煮肉菜闻名。器具、火候与公共烤炉相关的烹饪场景，提示食物与手艺、商业设施之间的联系，而不只是某种“沙漠味道”。',
      },
    ],
    sources: [
      source(
        'Medina of Marrakesh',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/331/',
        '麦地那、城墙与历史建筑',
      ),
      source(
        'Cultural space of Jemaa el-Fna Square',
        'UNESCO Intangible Cultural Heritage',
        'https://ich.unesco.org/en/RL/cultural-space-of-jemaa-el-fna-square-00014',
        '杰马夫纳广场的文化活动',
      ),
      source(
        'Marrakesh',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Marrakesh',
        '坐标、山前平原、riad 与地方餐饮线索',
      ),
    ],
  },
  {
    id: 'new-orleans',
    name: '新奥尔良',
    originalName: 'New Orleans',
    country: '美国',
    latitude: 29.9511,
    longitude: -90.0715,
    timezone: 'America/Chicago',
    tagline: '在密西西比河的弯道，听见街道。',
    intro:
      '密西西比河的弯道塑造了新奥尔良的城市轮廓。法国区的阳台、电车经过的街道与爵士乐演出的场所，让港口、迁徙和文化交往成为可被步行阅读的历史。',
    image: '/art/new-orleans.svg',
    accent: '#8b9a8a',
    stories: [
      {
        theme: 'geography',
        title: '河弯与湿地之间',
        body: '新奥尔良位于密西西比河下游，北侧邻近庞恰特雷恩湖，城市与三角洲湿地、水位管理紧密相连。堤防与排水设施是理解这里的重要线索。与尼罗河畔的开罗比较，河流都很重要，但两地的地貌、历史与水管理方式各不相同。',
      },
      {
        theme: 'architecture',
        title: '阳台下面的街道',
        body: '法国区的街道保留多时期建筑，铸铁或锻铁阳台是醒目的视觉线索。地区名称不意味着建筑都来自法国统治时期；火灾后的重建及西班牙时期的影响同样重要。庭院与连续的临街界面，构成适合步行观察的空间。',
      },
      {
        theme: 'life',
        title: '音乐有自己的地点',
        body: '爵士乐的形成与新奥尔良的非裔社群、铜管乐队传统和多种音乐交往相关。国家公园系统的爵士历史资料提供了具体脉络。音乐可以在俱乐部、游行和公园活动中出现，不能把每一条街都想象成永不停歇的舞台。',
      },
      {
        theme: 'food',
        title: '从 gumbo 读港口',
        body: 'Gumbo 是一种具有多种版本的炖汤，常与米饭同食，其食材和做法体现复杂的文化交汇。Beignet 则是常在咖啡馆遇见的炸面点。把具体餐馆与家庭传统放回历史中，比把克里奥尔与卡真料理混为一谈更能理解这里的饮食。',
      },
    ],
    sources: [
      source(
        'New Orleans',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/New_Orleans',
        'gumbo 与米饭、克里奥尔与卡真餐饮的基本区分；社区编辑旅行指南',
      ),
      source(
        'Jazz Origins in New Orleans',
        'U.S. National Park Service',
        'https://www.nps.gov/jazz/learn/historyculture/history_early.htm',
        '爵士乐历史、多种社群与音乐传统',
      ),
      source(
        'New Orleans',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/New_Orleans',
        '坐标、水系、法国区、电车与饮食线索',
      ),
      source(
        'French Quarter',
        'New Orleans & Company',
        'https://www.neworleans.com/plan/neighborhoods/french-quarter/',
        '法国区建筑与步行街区背景',
      ),
    ],
  },
  {
    id: 'houston',
    name: '休斯敦',
    originalName: 'Houston',
    country: '美国',
    latitude: 29.7604,
    longitude: -95.3698,
    timezone: 'America/Chicago',
    tagline: '摩天楼之间，一条缓慢的 bayou。',
    intro:
      '休斯敦铺展在得克萨斯东南部的沿海平原。玻璃塔楼之外，布法罗河湾沿岸的步道、社区餐馆与公共艺术，呈现这座港口与能源城市更细小的尺度。',
    image: '/art/houston.svg',
    accent: '#6d9493',
    stories: [
      {
        theme: 'geography',
        title: '平坦的海湾内陆',
        body: '休斯敦位于墨西哥湾沿岸平原，bayou 水道穿过城市。布法罗河湾是认识当地水文的一条主线，地势与强降雨也让防洪成为持续议题。它与新奥尔良地理相近，却有不同的河流形态和城市发展路径。',
      },
      {
        theme: 'architecture',
        title: '高楼与低密街区',
        body: '市中心的高层建筑与广阔的低密街区并存，道路网络对出行方式影响很大。莱斯大学一带的校园建筑和博物馆区，又提供了不同于商务区的空间尺度。观察一座城市，需要允许几种看起来不相同的城市形态同时存在。',
      },
      {
        theme: 'life',
        title: '沿布法罗河湾走一段',
        body: '布法罗河湾公园把河道、步道、公共艺术和活动空间连在一起。原蓄水池 Cistern 经改造成为可预约参观的空间。它展示基础设施如何被重新阅读，也让认识休斯敦的路线从公路延伸到可停留的河岸。',
      },
      {
        theme: 'food',
        title: '一座多入口的餐桌',
        body: '休斯敦的餐饮场景包含得州烧烤、墨西哥和越南等多种背景。Viet-Cajun 小龙虾是一条观察移民经营者如何改造地方风味的线索。具体餐馆的配方与故事各不相同，不能把这座多元城市压缩成一道代表菜。',
      },
    ],
    sources: [
      source(
        'Houston',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Houston',
        '城市区域与 bayou、餐饮多样性的背景；社区编辑旅行指南',
      ),
      source(
        'Buffalo Bayou Park',
        'Buffalo Bayou Partnership',
        'https://buffalobayou.org/location/buffalo-bayou-park/',
        '河湾公园、公共空间与步道',
      ),
      source(
        'Houston',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Houston',
        '坐标、海湾平原、建筑与餐饮背景',
      ),
      source(
        'About Houston',
        'Houston First / Visit Houston',
        'https://www.visithoustontexas.com/about-houston/',
        '城市地理、文化机构与多元餐饮背景',
      ),
    ],
  },
  {
    id: 'harbin',
    name: '哈尔滨',
    originalName: 'Harbin',
    country: '中国',
    latitude: 45.8038,
    longitude: 126.535,
    timezone: 'Asia/Shanghai',
    tagline: '沿松花江，走进冬天以外的故事。',
    intro:
      '松花江穿过哈尔滨，中央大街的建筑立面留下铁路与城市交往的痕迹。冰雪是其中一个季节，江边步道、市场和街头食物则提供了全年都可以进入的城市入口。',
    image: '/art/harbin.svg',
    accent: '#8ba3ad',
    stories: [
      {
        theme: 'geography',
        title: '松花江上的城市',
        body: '松花江把哈尔滨两岸的城市空间联系起来，太阳岛位于江的北岸。夏季绿地与冬季雪景让这片滨水空间呈现不同面貌。它与同纬度附近的蒙特利尔都拥有大河，却分别处在不同大陆的地理与城市历史之中。',
      },
      {
        theme: 'architecture',
        title: '中央大街的立面',
        body: '中央大街沿线可见巴洛克、折衷主义等不同建筑语汇，圣索菲亚教堂的穹顶则提供另一处观察入口。把商业街和具体建筑分别阅读，可以看见不同历史层次；这里并非一种完全统一的所谓欧洲风格。',
      },
      {
        theme: 'life',
        title: '江边的一段步行',
        body: '中央大街北端靠近松花江畔的防洪纪念塔。把商业街与河岸放进同一段步行，可以观察购物、停留与看江怎样相邻。这样的具体路线，是认识城市的一种入口；冰雪景观只是其中一个季节。',
      },
      {
        theme: 'food',
        title: '红肠与面包',
        body: '哈尔滨红肠与大列巴面包为观察城市的跨文化饮食交流提供了线索。它们在本地生产和消费中不断变化，也与东北地区更广泛的面食、炖菜传统并存。',
      },
    ],
    sources: [
      source(
        'Central Avenue',
        'China Daily · Government portal',
        'https://govt.chinadaily.com.cn/s/201711/24/WS5b784019498e855160e8cb5f/central-avenue.html',
        '中央大街的建筑语汇、商业用途及北端靠近松花江防洪纪念塔的位置',
      ),
      source(
        'St. Sophia Church',
        'China Daily · Government portal',
        'https://govt.chinadaily.com.cn/s/201711/24/WS5b784023498e855160e8cb65/st-sophia-church.html',
        '圣索菲亚教堂的建筑与穹顶；不引用陈旧票价或排名',
      ),
      source(
        'The Sun Island scenic area',
        'China Daily · Government portal',
        'https://govt.chinadaily.com.cn/s/201711/24/WS5b78402e498e855160e8cb6c/the-sun-island-scenic-area.html',
        '太阳岛位于松花江北岸及季节性的滨水景观；不引用排名或面积统计',
      ),
      source(
        'Red Sausage',
        'China Daily · Government portal',
        'https://govt.chinadaily.com.cn/s/201803/16/WS5b78719c498e855160e8e9be/red-sausage-hong-chang-hongchang.html',
        '哈尔滨红肠的存在与制作背景；不引用未经交叉核验的首创年份',
      ),
      source(
        'Great lieba bread',
        'China Daily · Government portal',
        'https://govt.chinadaily.com.cn/s/201803/16/WS5b787192498e855160e8e9b8/great-lieba-bread-da-lie-ba-mian-bao-daliebamianbao.html',
        '哈尔滨大列巴面包与具体地方生产者的关联；不引用重量或营销评价',
      ),
      source(
        'Harbin',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Harbin',
        '坐标、松花江、历史建筑与饮食线索',
      ),
      source(
        'Harbin',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Harbin',
        '地理、铁路与城市史',
      ),
    ],
  },
  {
    id: 'venice',
    name: '威尼斯',
    originalName: 'Venezia',
    country: '意大利',
    latitude: 45.4408,
    longitude: 12.3155,
    timezone: 'Europe/Rome',
    tagline: '街道有时是水，转角有时是一座桥。',
    intro:
      '威尼斯把建筑、岛屿和潟湖编成密集的步行网络。渡船与桥梁连接不同尺度的生活，离开最繁忙的广场，仍能在街角看到市场、船坞与邻里空间。',
    image: '/art/venice.svg',
    accent: '#91aaa5',
    stories: [
      {
        theme: 'geography',
        title: '潟湖中的群岛',
        body: '威尼斯建于亚得里亚海北端的潟湖岛屿，潮汐、水道与岛岸共同塑造空间。它与哈尔滨纬度接近，水环境却完全不同；城市的维护也需要面对潟湖生态和水位变化。',
      },
      {
        theme: 'architecture',
        title: '临水的立面',
        body: '总督宫朝向圣马可水域、广场与运河的翼楼，分别形成于不同建设阶段。它曾容纳总督居所和政府办公空间，今天作为公共博物馆开放。哥特式与文艺复兴等建筑元素的并置，让同一座建筑也能读出时间的层次。',
      },
      {
        theme: 'life',
        title: '在市场与渡船之间',
        body: '里亚托市场和 vaporetto 公共水上巴士是认识水城生活的两处入口。游客、运货者与居民共同使用有限空间；避开狭窄通道停留、尊重日常通行，也是一种阅读城市的方式。',
      },
      {
        theme: 'food',
        title: '小食与海产',
        body: 'Cicchetti 是酒吧里常见的小份食物，搭配可能包含鱼、蔬菜或面包。潟湖与海洋为食材提供线索，但贸易、餐饮经营和个人选择同样参与了威尼斯的餐桌。',
      },
    ],
    sources: [
      source(
        'Building and history — The Doge’s Palace',
        'Fondazione Musei Civici di Venezia',
        'https://palazzoducale.visitmuve.it/en/building-and-history/',
        '总督宫的临水建筑、不同年代的翼楼、曾经的官署与现代博物馆用途',
      ),
      source(
        'Venice Travel',
        'Lonely Planet',
        'https://www.lonelyplanet.com/italy/venice',
        '实际城市指南已访问：潟湖中的城市与临水宫邸；不核验具体餐馆',
      ),
      source(
        'Venice and its Lagoon',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/394/',
        '潟湖、岛屿和建筑遗产',
      ),
      source(
        'Venice',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Venice',
        '坐标、公共水上交通、市场与饮食线索',
      ),
    ],
  },
  {
    id: 'montreal',
    name: '蒙特利尔',
    originalName: 'Montréal',
    country: '加拿大',
    latitude: 45.5019,
    longitude: -73.5674,
    timezone: 'America/Toronto',
    tagline: '一座岛，一座山，许多种街角。',
    intro:
      '圣劳伦斯河中的岛屿承载着蒙特利尔，皇家山为街道提供方向。老港、外楼梯住宅和 Mile End 的店铺，可以串起一条关于河流、语言与移民的步行路线。',
    image: '/art/montreal.svg',
    accent: '#9d987e',
    stories: [
      {
        theme: 'geography',
        title: '圣劳伦斯河中的岛',
        body: '蒙特利尔位于圣劳伦斯河水系中的蒙特利尔岛，皇家山是岛上的重要地形标记。港口和河流交通参与了城市成长，而山上的公园提供了眺望街区的不同角度。',
      },
      {
        theme: 'architecture',
        title: '楼梯走向街道',
        body: 'Plateau 等街区可见带外楼梯的多户住宅，入口、阳台和人行道构成紧密的街道界面。老蒙特利尔的石砌建筑则展示另一时期的城市形态。两种尺度共同构成今天的城市。',
      },
      {
        theme: 'life',
        title: 'Mile End 的店门',
        body: 'Mile End 的咖啡馆、面包店和社区文化空间，是观察移民、语言与创意工作的一处入口。一个街区从来不只有一种身份，商业变化与居民生活也在持续重塑它。',
      },
      {
        theme: 'food',
        title: '贝果与熏肉三明治',
        body: '蒙特利尔式贝果常以木炉烘焙，熏肉三明治则与城市的犹太餐饮历史相连。具体店家的工艺与经营史各有差别；这两种食物是了解城市的入口，并非整座城市饮食的全部。',
      },
    ],
    sources: [
      source(
        'Montreal',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Montreal',
        '坐标、岛屿、皇家山、住宅与地方餐饮线索',
      ),
      source(
        'Montréal',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Montreal',
        '圣劳伦斯河、港口和城市史',
      ),
      source(
        'Mile End',
        'Tourisme Montréal',
        'https://www.mtl.org/en/experience/mile-end',
        '街区与文化活动；链接访问情况见来源记录',
      ),
    ],
  },
  {
    id: 'portland',
    name: '波特兰',
    originalName: 'Portland, Oregon',
    country: '美国',
    latitude: 45.5152,
    longitude: -122.6784,
    timezone: 'America/Los_Angeles',
    tagline: '过一座桥，换一个街区的节奏。',
    intro:
      '威拉米特河穿过俄勒冈州的波特兰，桥梁把两岸街区连接起来。河岸、公园与餐车聚落，让认识这座城市的方式可以从一次短短的步行和一份午餐开始。',
    image: '/art/portland.svg',
    accent: '#739382',
    stories: [
      {
        theme: 'geography',
        title: '两条河的区域',
        body: '波特兰位于威拉米特河与哥伦比亚河相汇的区域，市中心主要沿威拉米特河展开。周边山地与太平洋西北地区的气候背景共同构成环境，但城市生活也由港口、交通和社区历史塑造。',
      },
      {
        theme: 'architecture',
        title: '桥梁也是公共空间',
        body: '从钢桥到 Tilikum Crossing，不同桥梁承担不同的交通角色。后者服务公共交通、骑行与步行，为观察城市如何分配道路空间提供了具体案例。沿岸街区的尺度也并不完全一致。',
      },
      {
        theme: 'life',
        title: '到河边走一走',
        body: 'Tom McCall Waterfront Park 把原有交通空间转化为滨水公园，河岸现在容纳步行、活动与停留。城市公园并非自然地形的必然结果，它也是长期公共决策和维护的成果。',
      },
      {
        theme: 'food',
        title: '餐车聚落的午餐',
        body: '餐车聚落把多位经营者的厨房集合在一片场地，提供多种背景的食物。它们是波特兰餐饮的一种组织形式，选址、租金与城市规定也会影响摊主的生意和顾客的使用方式。',
      },
    ],
    sources: [
      source(
        'Portland (Oregon)',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Portland_(Oregon)',
        '威拉米特河、Tilikum Crossing 与餐车；社区编辑旅行指南',
      ),
      source(
        'Portland, Oregon',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Portland,_Oregon',
        '坐标、河流、桥梁与滨水公园',
      ),
      source(
        'Portland Food Carts',
        'Travel Portland',
        'https://www.travelportland.com/culture/food-carts/',
        '餐车及餐车聚落的具体场景',
      ),
    ],
  },
  {
    id: 'rio',
    name: '里约热内卢',
    originalName: 'Rio de Janeiro',
    country: '巴西',
    latitude: -22.9068,
    longitude: -43.1729,
    timezone: 'America/Sao_Paulo',
    tagline: '山峰与海湾之间，城市没有直线。',
    intro:
      '花岗岩山体、海湾与海滩交错，里约的街区顺着地形展开。科帕卡巴纳的步道和街角小餐馆提供了日常入口，也提醒我们明信片之外仍有复杂而多样的城市。',
    image: '/art/rio.svg',
    accent: '#789b8c',
    stories: [
      {
        theme: 'geography',
        title: '山与海的交错',
        body: '里约位于巴西东南部海岸，瓜纳巴拉湾、花岗岩山体与大西洋海滩共同构成地形。山地影响街区之间的联系，却不能单独解释城市中的社会差异；历史和公共政策同样重要。',
      },
      {
        theme: 'architecture',
        title: '地形中的景观设计',
        body: '里约的山海文化景观包括蒂茹卡山地、植物园与海滨公共空间。科帕卡巴纳步道的波纹铺装使步行空间具有鲜明图案，这是人工设计参与地理景观的一处具体案例。',
      },
      {
        theme: 'life',
        title: '一条海滨步道',
        body: '海滨步道承载散步、运动和街头经营，使用方式随地点、时段与人群而变化。海滩只是认识里约的一处入口；从海边转入住宅街区，会遇见不同的交通、商业与社区生活。',
      },
      {
        theme: 'food',
        title: '街角的餐馆',
        body: 'Feijoada 以豆类和肉类慢炖，常配米饭等食物，是巴西多地都能遇到的菜。里约的 botequim 小酒馆则提供认识邻里餐饮的一种空间线索；地方性也存在于具体店家和用餐方式中。',
      },
    ],
    sources: [
      source(
        'Rio de Janeiro',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Rio_de_Janeiro',
        '瓜纳巴拉湾、科帕卡巴纳与 feijoada；社区编辑旅行指南',
      ),
      source(
        'Rio de Janeiro: Carioca Landscapes between the Mountain and the Sea',
        'UNESCO World Heritage Centre',
        'https://whc.unesco.org/en/list/1100/',
        '山海文化景观与滨水设计',
      ),
      source(
        'Rio de Janeiro',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Rio_de_Janeiro',
        '坐标、海湾、步道与餐饮背景',
      ),
    ],
  },
  {
    id: 'sao-paulo',
    name: '圣保罗',
    originalName: 'São Paulo',
    country: '巴西',
    latitude: -23.5505,
    longitude: -46.6333,
    timezone: 'America/Sao_Paulo',
    tagline: '在高原大城里，找到一张共同的餐桌。',
    intro:
      '圣保罗位于巴西东南部高原，密集的街道和高层建筑里容纳着许多迁徙历史。保利斯塔大道、伊比拉普埃拉公园与自由区，让这座大城出现不同的步行尺度。',
    image: '/art/sao-paulo.svg',
    accent: '#969d85',
    stories: [
      {
        theme: 'geography',
        title: '海岸山地之后',
        body: '圣保罗坐落在巴西东南部高原，距大西洋海岸并不遥远，但与海岸之间有山地相隔。它与里约纬度相近，却形成不同的地形与城市轮廓。河流、道路和工业发展都参与了都市的扩展。',
      },
      {
        theme: 'architecture',
        title: '大道与架空的美术馆',
        body: '保利斯塔大道汇集文化机构与商业建筑，圣保罗艺术博物馆的架空体量是醒目的地标。建筑下方的开放空间展示了大型文化建筑如何与街道相接，也为城市活动提供一个可停留的场所。',
      },
      {
        theme: 'life',
        title: '公园与自由区',
        body: '伊比拉普埃拉公园提供绿地、文化建筑和步道；自由区则是观察日裔巴西人历史的一处入口。它们只是城市多种面貌的两例，移民社群和街区身份也会随时间持续变化。',
      },
      {
        theme: 'food',
        title: '迁徙留下的配方',
        body: '圣保罗的披萨店与日本料理店提示不同迁徙历史对餐饮的影响。市政市场的餐食又展示市场如何转向旅游与日常消费并存。食物的意义来自具体经营者、顾客和场景，并非一份固定的城市菜单。',
      },
    ],
    sources: [
      source(
        'São Paulo',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/S%C3%A3o_Paulo',
        '保利斯塔大道、自由区与伊比拉普埃拉公园；社区编辑旅行指南',
      ),
      source(
        'São Paulo',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/S%C3%A3o_Paulo',
        '坐标、高原、保利斯塔大道、自由区与餐饮线索',
      ),
      source(
        'MASP — About',
        'Museu de Arte de São Paulo Assis Chateaubriand',
        'https://masp.org.br/en/about',
        '博物馆建筑与开放空间',
      ),
      source(
        'São Paulo',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Sao-Paulo-Brazil',
        '高原地理、移民与城市史',
      ),
    ],
  },
  {
    id: 'antofagasta',
    name: '安托法加斯塔',
    originalName: 'Antofagasta',
    country: '智利',
    latitude: -23.6509,
    longitude: -70.3975,
    timezone: 'America/Santiago',
    tagline: '沙漠走到海边，留下一道石拱。',
    intro:
      '阿塔卡马沙漠的山坡与太平洋在安托法加斯塔相接。港口、铁路遗产和海滨步道讲述资源运输与城市成长，北侧的 La Portada 海蚀拱则显露海岸地貌。',
    image: '/art/antofagasta.svg',
    accent: '#b59679',
    stories: [
      {
        theme: 'geography',
        title: '沙漠与冷海相邻',
        body: '安托法加斯塔位于智利北部的太平洋岸，身后是阿塔卡马沙漠。寒流、沿岸地形与大尺度大气环流共同影响区域环境。南纬二十三度附近并不只有热带景观，这里正是一个直观的反例。',
      },
      {
        theme: 'architecture',
        title: '港口留下的城市结构',
        body: '港口和铁路与矿产运输的历史相连，旧码头和工业遗存提供了理解城市成长的线索。海滨道路与住宅街区沿狭长的海岸展开，山地与海洋共同限制了可建设空间。',
      },
      {
        theme: 'life',
        title: '把视线转向海岸',
        body: '海滨步道和公共海滩提供停留、运动与看海的空间。La Portada 位于城区以北，其海蚀拱是受保护的自然地标。到访应遵守保护区路径，海岸风景也需要持续维护。',
      },
      {
        theme: 'food',
        title: '从海产到市场',
        body: '鱼类和贝类为智利沿岸餐饮提供重要食材，海鲜馅 empanada 是一种可以遇到的做法。具体餐馆、供应季节与渔业管理影响餐桌，不能把整座城市的饮食仅归结为靠海。',
      },
    ],
    sources: [
      source(
        'Antofagasta',
        'Wikivoyage contributors',
        'https://en.wikivoyage.org/wiki/Antofagasta',
        'La Portada 位于城北、旧冶炼设施与港口的背景；社区编辑旅行指南',
      ),
      source(
        'Antofagasta',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Antofagasta',
        '坐标、海岸地形、港口和铁路背景',
      ),
      source(
        'La Portada',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/La_Portada',
        '海蚀拱、自然保护与海岸地貌',
      ),
      source(
        'Antofagasta',
        'Encyclopaedia Britannica',
        'https://www.britannica.com/place/Antofagasta-Chile',
        '沙漠港口与资源运输历史',
      ),
    ],
  },
  {
    id: 'alice-springs',
    name: '爱丽斯泉',
    originalName: 'Alice Springs · Mparntwe',
    country: '澳大利亚',
    latitude: -23.698,
    longitude: 133.8807,
    timezone: 'Australia/Darwin',
    tagline: '红色山脊之间，河流有时藏在沙下。',
    intro:
      '麦克唐奈山脉附近的爱丽斯泉位于澳大利亚内陆。托德河的干河床、红色山脊与城镇街道并置；这里也是 Arrernte 人持续生活、拥有文化联系的地方。',
    image: '/art/alice-springs.svg',
    accent: '#bb7b5e',
    stories: [
      {
        theme: 'geography',
        title: '内陆的间歇河流',
        body: '爱丽斯泉靠近麦克唐奈山脉，托德河穿过城镇，河道经常呈现干燥沙床。水文节奏与南纬相近的巴西沿海城市很不一样。纬度只是一个坐标，内陆位置、地形和大气环流共同参与环境形成。',
      },
      {
        theme: 'architecture',
        title: '电报站与城镇',
        body: '旧电报站是理解殖民时期通信网络和城镇建立的一处遗产地点。但这一历史并非当地故事的起点；Mparntwe 与周边土地早已有 Arrernte 人长久而持续的文化联系。',
      },
      {
        theme: 'life',
        title: '先听土地的讲述者',
        body: '认识 Mparntwe，应优先聆听获得授权的当地原住民讲述者，遵守地点的访问与摄影要求。城镇的画廊、文化机构和市场提供不同入口，但不应将多样的原住民文化简化成一种装饰风格。',
      },
      {
        theme: 'food',
        title: '食材也有知识的归属',
        body: '澳大利亚原生食材常被统称为 bush foods，但识别、采集和食用包含具体社群的知识。到访时宜通过当地认可的经营者和讲解了解，避免自行采食。现代城镇餐馆同样提供多种背景的菜肴。',
      },
    ],
    sources: [
      source(
        'Alice Springs',
        'Wikipedia contributors',
        'https://en.wikipedia.org/wiki/Alice_Springs',
        '坐标、托德河、麦克唐奈山脉、Mparntwe 与电报站历史',
      ),
      source(
        'Alice Springs',
        'Tourism Northern Territory',
        'https://northernterritory.com/alice-springs-and-surrounds',
        '区域地理、文化机构与到访背景',
      ),
      source(
        'Alice Springs Telegraph Station Historical Reserve',
        'Northern Territory Government',
        'https://nt.gov.au/parks/find-a-park/alice-springs-telegraph-station-historical-reserve',
        '电报站遗产与访问背景',
      ),
    ],
  },
];

export const placesById = Object.fromEntries(places.map((place) => [place.id, place])) as Record<
  string,
  Place
>;
