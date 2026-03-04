import { queryClient } from "./queryClient";

export async function apiRequest(method: string, url: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export function useTopDeals(minScore = 0, limit = 50) {
  return {
    queryKey: ["/api/deals/top", minScore, limit],
    queryFn: () => apiRequest("GET", `/api/deals/top?min_score=${minScore}&limit=${limit}`),
  };
}

export function useOverviewStats() {
  return {
    queryKey: ["/api/stats/overview"],
    queryFn: () => apiRequest("GET", "/api/stats/overview"),
  };
}

export function useMarketStats(city = "San Antonio") {
  return {
    queryKey: ["/api/stats/market", city],
    queryFn: () => apiRequest("GET", `/api/stats/market?city=${encodeURIComponent(city)}`),
  };
}

export function useListing(id: number) {
  return {
    queryKey: ["/api/listings", id],
    queryFn: () => apiRequest("GET", `/api/listings/${id}`),
    enabled: id > 0,
  };
}
