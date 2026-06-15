"use client";

/**
 * FreeRouteMap — Phase 2
 *
 * Props
 * ─────
 * route      — polyline as [lat, lng][] (from ORS or fallback straight line)
 * pickup     — [lat, lng] marker (green, draggable)
 * drop       — [lat, lng] marker (red)
 * car        — optional [lat, lng] for a moving car icon
 * onPickupDrag — called with new [lat, lng] when the user drags the pickup pin
 */

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

type LatLngTuple = [number, number];

interface FreeRouteMapProps {
  route: LatLngTuple[];
  pickup: LatLngTuple;
  drop: LatLngTuple;
  car?: LatLngTuple;
  onPickupDrag?: (coords: LatLngTuple) => void;
}

const LEAFLET_CSS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (window.L) return resolve();

    // CSS
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    // JS
    if (!document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      const script = document.createElement("script");
      script.src = LEAFLET_JS;
      script.onload = () => resolve();
      document.head.appendChild(script);
    } else {
      // already loading — poll
      const id = setInterval(() => {
        if (window.L) {
          clearInterval(id);
          resolve();
        }
      }, 50);
    }
  });
}

export function FreeRouteMap({
  route,
  pickup,
  drop,
  car,
  onPickupDrag,
}: FreeRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickupMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dropMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carMarkerRef = useRef<any>(null);

  const handlePickupDrag = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      const { lat, lng } = e.target.getLatLng();
      onPickupDrag?.([lat, lng]);
    },
    [onPickupDrag]
  );

  // ── Initial map setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current) return;
      const L = window.L;

      // Avoid double-init
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Small attribution in bottom-left
      L.control
        .attribution({ prefix: false, position: "bottomleft" })
        .addAttribution(
          '© <a href="https://openstreetmap.org/copyright">OSM</a>'
        )
        .addTo(map);

      // ── Markers ──────────────────────────────────────────────────────────
      const greenIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#1D9E75;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const redIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#D85A30;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const carIcon = L.divIcon({
        className: "",
        html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🚗</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const pickupMarker = L.marker(pickup, {
        icon: greenIcon,
        draggable: !!onPickupDrag,
        title: "Pickup — drag to adjust",
      }).addTo(map);

      if (onPickupDrag) pickupMarker.on("dragend", handlePickupDrag);
      pickupMarkerRef.current = pickupMarker;

      const dropMarker = L.marker(drop, { icon: redIcon, title: "Drop" }).addTo(map);
      dropMarkerRef.current = dropMarker;

      if (car) {
        carMarkerRef.current = L.marker(car, { icon: carIcon }).addTo(map);
      }

      // ── Polyline ──────────────────────────────────────────────────────────
      const poly = L.polyline(route, {
        color: "#7F77DD",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
      }).addTo(map);
      polylineRef.current = poly;

      // Fit bounds to route + markers
      const bounds = L.latLngBounds([pickup, drop, ...route]);
      map.fitBounds(bounds, { padding: [28, 28] });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
    };
    // intentionally run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync route/markers after initial mount ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;

    // Update polyline
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(route);
    }

    // Update markers
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLatLng(pickup);
      // re-bind dragend in case onPickupDrag reference changed
      pickupMarkerRef.current.off("dragend");
      if (onPickupDrag) pickupMarkerRef.current.on("dragend", handlePickupDrag);
    }

    if (dropMarkerRef.current) dropMarkerRef.current.setLatLng(drop);

    if (car && carMarkerRef.current) {
      carMarkerRef.current.setLatLng(car);
    }

    // Re-fit bounds
    const bounds = L.latLngBounds([pickup, drop, ...route]);
    mapRef.current.fitBounds(bounds, { padding: [28, 28] });
  }, [route, pickup, drop, car, onPickupDrag, handlePickupDrag]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}