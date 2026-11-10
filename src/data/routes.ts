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
      '从江南的湖，到高原的河谷，越过庭院、沙漠与密西西比河。八座城市，共享相近纬度，拥有各自的生活。',
    cityIds: [
      'houston',
      'new-orleans',
      'marrakesh',
      'cairo',
      'shiraz',
      'lhasa',
      'chengdu',
      'hangzhou',
    ],
  },
  {
    id: 'north-45',
    name: '北纬 45°',
    latitude: 45,
    band: 2,
    description: '从松花江到圣劳伦斯河，看看潟湖、桥梁与街区怎样把水写进城市。',
    cityIds: ['portland', 'montreal', 'venice', 'harbin'],
  },
  {
    id: 'south-23',
    name: '南纬 23°',
    latitude: -23,
    band: 2,
    description: '海岸、沙漠、高原与内陆：在南半球，把相近纬度放进不同的地理背景。',
    cityIds: ['antofagasta', 'sao-paulo', 'rio', 'alice-springs'],
  },
];
