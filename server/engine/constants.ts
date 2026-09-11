export const SA_CENTROID = { lat: 29.4241, lon: -98.4936 };
export const DEFAULT_RADIUS_MILES = 100;

export const SA_AREA_CITIES: Record<string, { lat: number; lon: number }> = {
  "san antonio": { lat: 29.4241, lon: -98.4936 },
  "new braunfels": { lat: 29.7030, lon: -98.1245 },
  "boerne": { lat: 29.7947, lon: -98.7320 },
  "seguin": { lat: 29.5688, lon: -97.9647 },
  "san marcos": { lat: 29.8833, lon: -97.9414 },
  "kyle": { lat: 29.9894, lon: -97.8772 },
  "lockhart": { lat: 29.8849, lon: -97.6700 },
  "helotes": { lat: 29.5780, lon: -98.6917 },
  "castroville": { lat: 29.3558, lon: -98.8786 },
  "pleasanton": { lat: 28.9672, lon: -98.4789 },
  "floresville": { lat: 29.1336, lon: -98.1561 },
  "schertz": { lat: 29.5522, lon: -98.2697 },
  "cibolo": { lat: 29.5619, lon: -98.2269 },
  "live oak": { lat: 29.5644, lon: -98.3364 },
  "universal city": { lat: 29.5480, lon: -98.2911 },
  "converse": { lat: 29.5172, lon: -98.3153 },
  "selma": { lat: 29.5858, lon: -98.3081 },
  "garden ridge": { lat: 29.6350, lon: -98.3053 },
  "kerrville": { lat: 30.0474, lon: -99.1404 },
  "fredericksburg": { lat: 30.2752, lon: -98.8720 },
  "eagle pass": { lat: 28.7091, lon: -100.4995 },
  "del rio": { lat: 29.3627, lon: -100.8968 },
  "laredo": { lat: 27.5036, lon: -99.5076 },
  "austin": { lat: 30.2672, lon: -97.7431 },
  "round rock": { lat: 30.5083, lon: -97.6789 },
  "georgetown": { lat: 30.6328, lon: -97.6781 },
};

export const RELIABILITY_SCORES: Record<string, number> = {
  "toyota_tacoma": 95,
  "toyota_4runner": 94,
  "toyota_camry": 93,
  "toyota_corolla": 92,
  "toyota_rav4": 91,
  "toyota_highlander": 90,
  "toyota_tundra": 89,
  "honda_civic": 93,
  "honda_accord": 92,
  "honda_crv": 91,
  "honda_pilot": 88,
  "lexus_rx": 92,
  "lexus_es": 91,
  "mazda_cx5": 90,
  "mazda_3": 89,
  "subaru_outback": 86,
  "subaru_forester": 85,
  "ford_f150": 82,
  "ford_ranger": 80,
  "ford_explorer": 78,
  "ford_bronco": 77,
  "ford_mustang": 76,
  "chevrolet_silverado": 80,
  "chevrolet_tahoe": 79,
  "chevrolet_equinox": 77,
  "chevrolet_colorado": 76,
  "gmc_sierra": 79,
  "gmc_yukon": 78,
  "ram_1500": 78,
  "ram_2500": 77,
  "jeep_wrangler": 73,
  "jeep_grand cherokee": 72,
  "dodge_charger": 70,
  "dodge_challenger": 70,
  "nissan_altima": 75,
  "nissan_rogue": 74,
  "nissan_frontier": 76,
  "hyundai_tucson": 80,
  "hyundai_elantra": 79,
  "kia_telluride": 82,
  "kia_sportage": 80,
  "volkswagen_jetta": 72,
  "bmw_3 series": 65,
  "bmw_x5": 64,
  "mercedes_c-class": 63,
  "audi_a4": 64,
};

export const SA_DEMAND_BOOSTS: Record<string, number> = {
  "toyota_tacoma": 18,
  "toyota_4runner": 15,
  "toyota_tundra": 12,
  "ford_f150": 18,
  "ford_ranger": 10,
  "ford_bronco": 12,
  "chevrolet_silverado": 16,
  "chevrolet_tahoe": 14,
  "chevrolet_colorado": 10,
  "gmc_sierra": 14,
  "gmc_yukon": 12,
  "ram_1500": 15,
  "ram_2500": 12,
  "jeep_wrangler": 13,
  "jeep_grand cherokee": 10,
};

export const SA_DEMAND_PENALTIES: Record<string, number> = {
  "bmw_3 series": -8,
  "bmw_4 series": -10,
  "mercedes_c-class": -8,
  "mercedes_cla": -10,
  "audi_a4": -6,
  "audi_a5": -8,
  "dodge_charger": -5,
  "dodge_challenger": -7,
  "volkswagen_jetta": -4,
};

export const VEHICLE_SEGMENTS: Record<string, string> = {
  "f150": "full-size trucks",
  "f-150": "full-size trucks",
  "silverado": "full-size trucks",
  "silverado 1500": "full-size trucks",
  "sierra": "full-size trucks",
  "1500": "full-size trucks",
  "2500": "full-size trucks",
  "tundra": "full-size trucks",
  "tacoma": "mid-size trucks",
  "ranger": "mid-size trucks",
  "colorado": "mid-size trucks",
  "frontier": "mid-size trucks",
  "canyon": "mid-size trucks",
  "tahoe": "large suvs",
  "yukon": "large suvs",
  "expedition": "large suvs",
  "suburban": "large suvs",
  "4runner": "mid-size suvs",
  "rav4": "mid-size suvs",
  "crv": "mid-size suvs",
  "cr-v": "mid-size suvs",
  "highlander": "mid-size suvs",
  "explorer": "mid-size suvs",
  "wrangler": "mid-size suvs",
  "bronco": "mid-size suvs",
  "camry": "sedans",
  "corolla": "sedans",
  "civic": "sedans",
  "accord": "sedans",
  "altima": "sedans",
  "elantra": "sedans",
  "jetta": "sedans",
};

export function getVehicleSegment(model: string): string {
  const lm = model.toLowerCase();
  return VEHICLE_SEGMENTS[lm] || "other";
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
