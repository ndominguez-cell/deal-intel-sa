import raw from "@/data/ancira-south-park-nissan-suv-live.json";

export type LiveAnciraVehicle = (typeof raw.vehicles)[number];

export function getRankedLiveAncira(): LiveAnciraVehicle[] {
  return raw.vehicles as LiveAnciraVehicle[];
}

export function getLiveAnciraVehicle(stock: string): LiveAnciraVehicle | undefined {
  return getRankedLiveAncira().find((vehicle) => vehicle.stock_number === stock);
}

export function getLiveTopThree(): LiveAnciraVehicle[] {
  return getRankedLiveAncira().slice(0, 3);
}

export function getLiveAnciraSource() {
  return raw.source;
}
