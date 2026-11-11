import { NextRequest } from 'next/server';
import { api } from '../../../lib/server/http';
import { compareSchema } from '../../../lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return api(
    request,
    ({ store }) => {
      const ids = compareSchema.parse(request.nextUrl.searchParams.get('ids')?.split(','));
      const places = ids.map((id) => store.getPlace(id));
      const [a, b] = places;
      const difference = Math.abs(a.latitude - b.latitude);
      const similarities =
        difference <= 4
          ? `两座城市的纬度仅相差 ${difference.toFixed(2)}°。相近的南北位置提供了比较自然环境的线索；海陆位置、地形与各自的历史仍让生活呈现不同面貌。以下文字依据各城市所列资料展开。`
          : `两座城市相隔 ${difference.toFixed(2)}° 纬度。可以从水系、街区与公共空间等相同维度阅读它们；纬度本身不能解释文化，具体情境需结合各城市的来源。`;
      const geography = (place: typeof a) =>
        place.stories.find((story) =>
          /自然|地理|geography|nature/.test(`${story.theme} ${story.title}`),
        )?.body || place.intro;
      const firstSentence = (text: string) => text.split(/(?<=[。！？])/u)[0];
      return {
        places,
        similarities,
        differences: `${a.name}：${firstSentence(geography(a))} ${b.name}：${firstSentence(geography(b))}这些具体地理条件是阅读城市的切入点，并不决定当地人的生活方式。`,
        metrics: {
          latitudeDifference: Number(difference.toFixed(4)),
          elevationDifference:
            typeof a.elevation === 'number' && typeof b.elevation === 'number'
              ? Math.abs(a.elevation - b.elevation)
              : null,
          places: places.map((place) => ({
            id: place.id,
            latitude: place.latitude,
            longitude: place.longitude,
            timezone: place.timezone,
            elevation: place.elevation ?? null,
          })),
          climate: null,
          climateNote: '尚未接入可比较的气候数据，纬度不能代替气候。',
        },
      };
    },
    { public: true },
  );
}
