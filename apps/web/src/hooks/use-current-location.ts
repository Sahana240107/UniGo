"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@/lib/maps/openroute";

export function useCurrentLocation() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => setError("Unable to detect current location.")
    );
  }, []);

  return { location, error, requestLocation };
}

