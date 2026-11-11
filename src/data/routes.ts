export type Route = {
  id: string;
  name: string;
  latitude: number;
  band: number;
  description: string;
  cityIds: string[];
};

export const routes: Route[] = [
  {
    id: 'north-30',
    name: '北纬 30°',
    latitude: 30,
    band: 2,
    description:
      '从江南的湖，到高原的河谷，越过庭院、沙漠与密西西比河。在相近纬度中，观察不同地形与具体街区。',
    cityIds: [
      'austin',
      'houston',
      'new-orleans',
      'agadir',
      'marrakesh',
      'alexandria',
      'cairo',
      'amman',
      'shiraz',
      'lhasa',
      'chengdu',
      'hangzhou',
      'suzhou',
    ],
  },
  {
    id: 'north-45',
    name: '北纬 45°',
    latitude: 45,
    band: 2,
    description: '从松花江到圣劳伦斯河，看看潟湖、桥梁与街区怎样把水写进城市。',
    cityIds: ['portland', 'montreal', 'lyon', 'venice', 'bucharest', 'harbin'],
  },
  {
    id: 'south-23',
    name: '南纬 23°',
    latitude: -23,
    band: 2,
    description: '海岸、沙漠、高原与内陆：在南半球，把相近纬度放进不同的地理背景。',
    cityIds: ['antofagasta', 'sao-paulo', 'rio', 'windhoek', 'alice-springs'],
  },
  {
    id: 'equator',
    name: '赤道附近',
    latitude: 0,
    band: 2,
    description:
      '高地、湖岸与海峡彼此相遇。沿赤道附近的真实城市，读懂相近太阳高度背后不同的地形与历史。',
    cityIds: ['quito', 'libreville', 'kigali', 'kampala', 'nairobi', 'singapore', 'pontianak'],
  },
  {
    id: 'north-15',
    name: '北纬 15°',
    latitude: 15,
    band: 2,
    description:
      '从美洲高地到大西洋岛屿，再到大河与亚洲港湾。把季风、河流与具体的城市生活放在同一页。',
    cityIds: ['guatemala-city', 'praia', 'dakar', 'niamey', 'khartoum', 'bangkok', 'manila'],
  },
  {
    id: 'north-35',
    name: '北纬 35°',
    latitude: 35,
    band: 2,
    description:
      '跨过太平洋、地中海与大陆腹地，沿盆地、海岸和街巷寻找城市的细部。纬度只是相遇的起点。',
    cityIds: ['los-angeles', 'fez', 'nicosia', 'beirut', 'tehran', 'xian', 'kyoto', 'tokyo'],
  },
  {
    id: 'north-60',
    name: '北纬 60°',
    latitude: 60,
    band: 2,
    description:
      '阿拉斯加的海湾、北欧的岛屿与波罗的海岸。看看高纬日照、海洋位置与人的营建怎样共同进入城市。',
    cityIds: [
      'anchorage',
      'bergen',
      'oslo',
      'stockholm',
      'tallinn',
      'helsinki',
      'saint-petersburg',
    ],
  },
  {
    id: 'south-34',
    name: '南纬 34°',
    latitude: -34,
    band: 2,
    description:
      '从安第斯山麓来到河口、半岛与南部海岸。城市在相近纬度中，展现不同的水系、港口与公共空间。',
    cityIds: [
      'valparaiso',
      'santiago',
      'buenos-aires',
      'montevideo',
      'cape-town',
      'adelaide',
      'sydney',
    ],
  },
];
