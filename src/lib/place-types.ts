export type Source = {
  title: string;
  publisher: string;
  url: string;
  accessedAt: string;
  status: 'verified' | 'pending';
  scope: string;
};
export type Story = { theme: string; title: string; body: string };
export type RelatedPlace = {
  id: string;
  name: string;
  country: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  /** Initial great-circle bearing, expressed as a readable compass direction. */
  direction?: string;
};
/** Calculated geography, kept distinct from editorial history and culture. */
export type PlaceProfile = {
  regionText: string;
  coordinateText: string;
  latitudeText: string;
  timezoneText: string;
  elevationText?: string;
  aliases?: string[];
  nearby: RelatedPlace[];
  /** Nearest places with existing curated stories; not a claim of cultural similarity. */
  related: RelatedPlace[];
};
export type PlaceArticle = {
  title: string;
  paragraphs: string[];
  source: {
    title: string;
    url: string;
    publisher: string;
    accessedAt: string;
    license: string;
    licenseUrl: string;
    /** Full HTTPS URL of the actual source revision. */
    revision?: string;
    scope?: string;
  };
};
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
  profile?: PlaceProfile;
  article?: PlaceArticle;
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
  hasArticle?: boolean;
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
    hasArticle: Boolean(place.article),
  };
}
