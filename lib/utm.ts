/**
 * UTM + click-id capture and persistence.
 *
 * On first load we read attribution params off window.location, persist them to
 * sessionStorage, and thereafter always return the persisted values. This means
 * a user who navigates within the funnel (or whose querystring gets stripped)
 * keeps the attribution that brought them in.
 */

export interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  gclid: string;
  fbclid: string;
}

const STORAGE_KEY = "sa_auto_match_utm";

const EMPTY: UtmParams = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  gclid: "",
  fbclid: "",
};

const KEYS: (keyof UtmParams)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readFromStorage(): UtmParams | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UtmParams>;
    return { ...EMPTY, ...parsed };
  } catch {
    return null;
  }
}

function writeToStorage(params: UtmParams): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    /* storage may be unavailable (private mode / disabled); fail silently */
  }
}

function readFromUrl(): UtmParams {
  if (!isBrowser()) return { ...EMPTY };
  const result: UtmParams = { ...EMPTY };
  try {
    const search = new URLSearchParams(window.location.search);
    for (const key of KEYS) {
      const value = search.get(key);
      if (value) {
        result[key] = value.trim();
      }
    }
  } catch {
    /* ignore malformed querystrings */
  }
  return result;
}

/**
 * Capture attribution params on first load. Merges any new (non-empty) URL
 * params over previously stored values, then persists. Safe to call multiple
 * times; safe to call during SSR (no-op).
 */
export function captureUtmParams(): UtmParams {
  if (!isBrowser()) return { ...EMPTY };

  const stored = readFromStorage();
  const fromUrl = readFromUrl();

  // Start from stored (or empty), then overlay any non-empty URL values so we
  // never blank out an existing attribution with an empty querystring.
  const merged: UtmParams = { ...EMPTY, ...(stored ?? {}) };
  for (const key of KEYS) {
    if (fromUrl[key]) {
      merged[key] = fromUrl[key];
    }
  }

  writeToStorage(merged);
  return merged;
}

/**
 * Return the persisted attribution params. If nothing has been captured yet,
 * attempts a capture first (covers direct component usage without an explicit
 * capture call).
 */
export function getUtmParams(): UtmParams {
  if (!isBrowser()) return { ...EMPTY };
  const stored = readFromStorage();
  if (stored) return stored;
  return captureUtmParams();
}
