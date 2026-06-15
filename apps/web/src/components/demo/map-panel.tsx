"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/maps/free-route-map";

const FreeRouteMap = dynamic(
  () => import("@/components/maps/free-route-map").then((mod) => mod.FreeRouteMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#e8f4f8]" />
  }
);

const defaultRoute: MapPoint[] = [
  [10.7597, 78.8132],
  [10.7607, 78.8141],
  [10.7621, 78.8152],
  [10.7632, 78.8171],
  [10.7641, 78.8187]
];

export function MapPanel({
  route = defaultRoute,
  live = false,
  label = "OpenStreetMap"
}: {
  route?: MapPoint[];
  live?: boolean;
  label?: string;
}) {
  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-gray-200 bg-[#e8f4f8] shadow-sm">
      <FreeRouteMap
        route={route}
        pickup={route[0]}
        drop={route[route.length - 1]}
        car={live ? route[2] : undefined}
      />
      <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#534ab7] shadow-sm">
        {label}
      </div>
      {live ? (
        <>
          <div className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm">
            ETA 4 min
          </div>
          <div className="absolute bottom-4 right-4 rounded-full bg-[#e24b4a] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
            SOS
          </div>
        </>
      ) : (
        <div className="absolute bottom-4 right-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
          4.8 km, 14 min
        </div>
      )}
    </div>
  );
}

