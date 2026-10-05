import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { captureAttribution, initMetaPixel } from "@/lib/campaign";

export function MetaPixel() {
  const { data } = useQuery({
    queryKey: ["public-config"],
    queryFn: () => apiRequest("GET", "/api/public-config"),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (typeof data?.metaPixelId === "string" && data.metaPixelId) {
      initMetaPixel(data.metaPixelId);
    }
  }, [data?.metaPixelId]);

  return null;
}
