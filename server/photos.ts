// MarketCheck's cached listing photos live on its API host and are served only
// with the account's API key, so a browser can't load them directly. Listings
// point at /api/photo/... instead, and the Worker fetches the image with the key
// server-side and caches it at the edge (photo URLs are content-addressed).

const MARKETCHECK_PHOTO = /^https:\/\/api\.marketcheck\.com\/v2\/image\/cache\/car\/([A-Za-z0-9-]{1,80})\/([a-f0-9]{16,64})$/;
const PUBLIC_PHOTO = /^\/api\/photo\/car\/([A-Za-z0-9-]{1,80})\/([a-f0-9]{16,64})$/;

export const PHOTO_CACHE_SECONDS = 60 * 60 * 24 * 30;

/** Rewrites a MarketCheck cached-photo URL to this app's photo route; other URLs pass through. */
export function toPublicImageUrl(url: string): string {
  const match = MARKETCHECK_PHOTO.exec(url);
  return match ? `/api/photo/car/${match[1]}/${match[2]}` : url;
}

/** Maps a /api/photo/... path back to the MarketCheck photo URL (without the key), or null if invalid. */
export function marketCheckPhotoUrl(pathname: string): string | null {
  const match = PUBLIC_PHOTO.exec(pathname);
  return match ? `https://api.marketcheck.com/v2/image/cache/car/${match[1]}/${match[2]}` : null;
}
