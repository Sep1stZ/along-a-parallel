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
  level?: 'catalog' | 'curated';
  kind?: 'city' | 'town' | 'settlement';
  countryCode?: string;
  admin?: string;
  elevation?: number | null;
  geonamesId?: number;
  aliases?: string[];
};
export type PlaceSummary = Pick<
  Place,
  | 'id'
  | 'name'
  | 'originalName'
  | 'country'
  | 'latitude'
  | 'longitude'
  | 'timezone'
  | 'image'
  | 'accent'
> & {
  level: 'catalog' | 'curated';
  kind: 'city' | 'town' | 'settlement';
  hasStory: boolean;
  countryCode?: string;
  admin?: string;
  elevation?: number | null;
  geonamesId?: number;
  aliases?: string[];
};
export function summarizePlace(place: Place): PlaceSummary {
  return {
    id: place.id,
    name: place.name,
    originalName: place.originalName,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
    image: place.image,
    accent: place.accent,
    level: place.level ?? 'curated',
    kind: place.kind ?? 'city',
    hasStory: place.stories.length > 0,
    countryCode: place.countryCode,
    admin: place.admin,
    elevation: place.elevation,
    geonamesId: place.geonamesId,
    aliases: place.aliases,
  };
}
