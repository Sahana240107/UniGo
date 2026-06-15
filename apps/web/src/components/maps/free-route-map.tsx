"use client";

import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap
} from "react-leaflet";
import { useEffect } from "react";

export type MapPoint = [number, number];

type FreeRouteMapProps = {
  route: MapPoint[];
  pickup?: MapPoint;
  drop?: MapPoint;
  car?: MapPoint;
  className?: string;
};

export function FreeRouteMap({
  route,
  pickup,
  drop,
  car,
  className
}: FreeRouteMapProps) {
  const center = route[Math.floor(route.length / 2)] ?? [10.7605, 78.8147];

  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl={false}
      className={className ?? "h-full w-full"}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="OpenStreetMap"
      />
      <FitRoute route={route} />
      <Polyline
        positions={route}
        pathOptions={{ color: "#7f77dd", weight: 6, opacity: 0.86 }}
      />
      {pickup ? (
        <CircleMarker
          center={pickup}
          radius={8}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1d9e75", fillOpacity: 1 }}
        />
      ) : null}
      {drop ? (
        <CircleMarker
          center={drop}
          radius={8}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#d85a30", fillOpacity: 1 }}
        />
      ) : null}
      {car ? (
        <CircleMarker
          center={car}
          radius={10}
          pathOptions={{ color: "#ffffff", weight: 4, fillColor: "#534ab7", fillOpacity: 1 }}
        />
      ) : null}
    </MapContainer>
  );
}

function FitRoute({ route }: { route: MapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route, { padding: [28, 28] });
    }
  }, [map, route]);

  return null;
}

