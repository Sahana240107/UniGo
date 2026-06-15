"use client";

import { useState, useEffect, useCallback } from "react";

export type LatLng = { lat: number; lng: number };

export type GeolocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "success"; coords: LatLng; address: string }
  | { status: "error"; message: string };

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "UniGo/1.0" },
  });
  if (!res.ok) throw new Error("Nominatim reverse geocode failed");
  const data = await res.json();

  // Build a compact readable label
  const a = data.address ?? {};
  const parts: string[] = [];

  // Prefer a named building/amenity/road
  const primary =
    a.amenity ?? a.building ?? a.road ?? a.pedestrian ?? a.suburb ?? "";
  if (primary) parts.push(primary);

  // City/town/village
  const city = a.city ?? a.town ?? a.village ?? a.county ?? "";
  if (city && city !== primary) parts.push(city);

  // State as a trailing hint
  if (a.state && parts.length < 3) parts.push(a.state);

  return parts.length > 0 ? parts.join(", ") : data.display_name ?? "";
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: "error", message: "Geolocation not supported" });
      return;
    }

    setState({ status: "locating" });

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        try {
          const address = await reverseGeocode(lat, lng);
          setState({ status: "success", coords: { lat, lng }, address });
        } catch {
          // Fall back to raw coords if reverse-geocode fails
          setState({
            status: "success",
            coords: { lat, lng },
            address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          });
        }
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied",
          2: "Location unavailable",
          3: "Location request timed out",
        };
        setState({
          status: "error",
          message: messages[err.code] ?? "Unknown error",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, []);

  // Auto-locate on mount
  useEffect(() => {
    locate();
  }, [locate]);

  return { state, retry: locate };
}