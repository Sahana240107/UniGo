"use client";

import { useState, useCallback, useRef } from "react";
import type { LatLng } from "./use-geolocation";

export type DropSuggestion = {
  placeId: string;
  name: string;
  displayName: string;
  meta: string;       // "Campus core · 4.8 km away"
  eta: string;        // "14 min"
  lat: number;
  lng: number;
};

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Rough ETA assuming 30 km/h average urban speed
function etaMin(km: number): number {
  return Math.round((km / 30) * 60);
}

// Shorten the Nominatim display_name to a compact label
function shortName(displayName: string): string {
  const parts = displayName.split(",").map((p) => p.trim());
  // Take first 2–3 meaningful parts
  return parts.slice(0, 3).join(", ");
}

export function useDropAutocomplete(userCoords: LatLng | null) {
  const [suggestions, setSuggestions] = useState<DropSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      // Clear previous debounce
      if (timerRef.current) clearTimeout(timerRef.current);

      if (query.trim().length < 3) {
        setSuggestions([]);
        return;
      }

      timerRef.current = setTimeout(async () => {
        // Cancel previous in-flight request
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        try {
          const params = new URLSearchParams({
            q: query,
            format: "json",
            limit: "5",
            addressdetails: "1",
            "accept-language": "en",
            countrycodes: "in",
          });

          // If we know the user's location, bias results toward it
          if (userCoords) {
            params.set("lat", String(userCoords.lat));
            params.set("lon", String(userCoords.lng));
          }

          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            {
              signal: abortRef.current.signal,
              headers: { "User-Agent": "UniGo/1.0" },
            }
          );
          const data = await res.json();

          const results: DropSuggestion[] = (data as NominatimResult[]).map(
            (item) => {
              const dest: LatLng = {
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              };

              const distKm = userCoords ? haversineKm(userCoords, dest) : null;
              const eta = distKm != null ? etaMin(distKm) : null;
              const distLabel =
                distKm != null ? `${distKm.toFixed(1)} km away` : "";
              const etaLabel = eta != null ? `${eta} min` : "";

              const addressParts: string[] = [];
              const a = item.address ?? {};
              const suburb = a.suburb ?? a.neighbourhood ?? "";
              const city = a.city ?? a.town ?? a.village ?? "";
              if (suburb) addressParts.push(suburb);
              if (city && city !== suburb) addressParts.push(city);

              const meta = [addressParts.join(", "), distLabel]
                .filter(Boolean)
                .join(" · ");

              return {
                placeId: item.place_id,
                name: shortName(item.display_name),
                displayName: item.display_name,
                meta,
                eta: etaLabel,
                lat: dest.lat,
                lng: dest.lng,
              };
            }
          );

          setSuggestions(results);
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== "AbortError") {
            setSuggestions([]);
          }
        } finally {
          setLoading(false);
        }
      }, 350); // 350 ms debounce
    },
    [userCoords]
  );

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, loading, search, clear };
}

// ─── Nominatim types ──────────────────────────────────────────────────────────
interface NominatimResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
  };
}