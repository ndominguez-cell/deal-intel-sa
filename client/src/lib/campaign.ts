const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

type CampaignEvent =
  | "ViewContent"
  | "Lead"
  | "Search"
  | "SelectDeal"
  | "StartAvailabilityRequest";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: ((action: string, event: string, parameters?: Record<string, unknown>) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: Window["fbq"];
  }
}

function storageKey(key: string) {
  return `dealintel:${key}`;
}

export function captureAttribution(search = window.location.search) {
  const params = new URLSearchParams(search);
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value) sessionStorage.setItem(storageKey(key), value.slice(0, 500));
  }
}

export function getAttribution() {
  return Object.fromEntries(
    ATTRIBUTION_KEYS.map((key) => [key, sessionStorage.getItem(storageKey(key))]),
  ) as Record<(typeof ATTRIBUTION_KEYS)[number], string | null>;
}

export function withAttribution(path: string) {
  const url = new URL(path, window.location.origin);
  const attribution = getAttribution();
  for (const key of ATTRIBUTION_KEYS) {
    if (attribution[key]) url.searchParams.set(key, attribution[key] as string);
  }
  return `${url.pathname}${url.search}`;
}

export function trackCampaignEvent(
  event: CampaignEvent,
  parameters: Record<string, unknown> = {},
) {
  const payload = { event, ...parameters };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);

  if (typeof window.fbq === "function") {
    const standardEvents = new Set(["ViewContent", "Lead", "Search"]);
    window.fbq(standardEvents.has(event) ? "track" : "trackCustom", event, parameters);
  }
}

export function initMetaPixel(pixelId: string) {
  if (!/^\d{5,30}$/.test(pixelId) || window.fbq) return;

  type Fbq = NonNullable<Window["fbq"]>;
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", pixelId);
  fbq("track", "PageView");
}
