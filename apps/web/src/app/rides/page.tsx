// d:\New-project\unigo\apps\web\src\app\rides\[id]\page.tsx
"use client";

import { getToken } from "@/utils/storage";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Loader2, MapPin, Route, Users, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";

const FreeRouteMap = dynamic(
  () => import("@/components/maps/free-route-map").then((m) => m.FreeRouteMap),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#e8f4f8]" /> }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type RideDetail = {
  id: string;
  driver_name: string;
  driver_reliability: number;
  pickup_address: string;
  dropoff_address: string;
  departure_time: string;
  seats_available: number;
  seats_total: number;
  women_only: boolean;
  fare_share: number;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  status: string;
};

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = getToken();
    fetch(`${API_BASE}/rides/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => setRide(data))
      .catch((e) => setError(`Could not load ride: ${e.message}`))
      .finally(() => setLoading(false));
  }, [id]);

  const handleJoin = async () => {
    if (!ride) return;
    setJoining(true);
    try {
      const joinToken = getToken();
      const res = await fetch(`${API_BASE}/rides/${id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(joinToken ? { Authorization: `Bearer ${joinToken}` } : {}),
        },
        body: JSON.stringify({
          pickup_lat: ride.pickup_lat,
          pickup_lng: ride.pickup_lng,
          pickup_address: ride.pickup_address,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? res.status);
      }
      setJoined(true);
    } catch (e: any) {
      setError(`Could not join: ${e.message}`);
    } finally {
      setJoining(false);
    }
  };

  const initials = (ride?.driver_name ?? "??")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const departureLabel = ride?.departure_time
    ? new Date(ride.departure_time).toLocaleString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const pickup: [number, number] | null = ride
    ? [ride.pickup_lat, ride.pickup_lng]
    : null;
  const drop: [number, number] | null = ride
    ? [ride.dropoff_lat, ride.dropoff_lng]
    : null;
  const polyline: [number, number][] =
    pickup && drop ? [pickup, drop] : [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7f77dd]" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-red-500">
        <AlertCircle className="h-6 w-6" />
        {error ?? "Ride not found"}
        <Link href="/commute" className="text-[#7f77dd] underline">
          Back to commute
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <Link
              href="/commute"
              className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <p className="text-xs font-medium text-[#534ab7]">UniGo</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {ride.driver_name}&apos;s ride
            </h1>
            <p className="mt-1 text-sm text-gray-500">{departureLabel}</p>
          </div>
          {ride.women_only && (
            <span className="shrink-0 rounded-full bg-[#fbeaf0] px-3 py-1 text-xs font-medium text-[#993556]">
              Women only
            </span>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: map + route */}
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="relative h-64 bg-[#e8f4f8]">
                {polyline.length > 0 && pickup && drop && (
                  <FreeRouteMap
                    route={polyline}
                    pickup={pickup}
                    drop={drop}
                    onPickupDrag={() => {}}
                  />
                )}
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-[#1d9e75]" />
                  <div>
                    <p className="text-xs text-gray-500">Pickup</p>
                    <p className="text-sm font-medium">{ride.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-[#d85a30]" />
                  <div>
                    <p className="text-xs text-gray-500">Drop</p>
                    <p className="text-sm font-medium">{ride.dropoff_address}</p>
                  </div>
                </div>
              </div>
              <div className="mx-4 mb-4 rounded-xl bg-[#eaf3de] p-3 text-sm font-medium text-[#27500a]">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  RouteMorph will adjust pickup order as riders join.
                </div>
              </div>
            </div>
          </div>

          {/* Right: driver + actions */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#afa9ec] font-semibold text-[#3c3489]">
                  {initials}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{ride.driver_name}</h2>
                  <p className="text-sm text-gray-500">
                    {ride.driver_reliability} reliability score
                  </p>
                </div>
              </div>
              <p className="text-right text-lg font-semibold">
                Rs. {Math.round(ride.fare_share)}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniStat
                icon={<Clock3 className="h-4 w-4" />}
                label="Time"
                value={new Date(ride.departure_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              <MiniStat
                icon={<Users className="h-4 w-4" />}
                label="Seats"
                value={`${ride.seats_available} left`}
              />
              <MiniStat
                icon={<MapPin className="h-4 w-4" />}
                label="Status"
                value={ride.status}
              />
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {joined ? (
              <div className="mt-5 rounded-xl bg-[#eaf3de] p-4 text-center text-sm font-medium text-[#27500a]">
                ✓ Request sent! Waiting for driver to accept.
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining || ride.seats_available === 0}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7f77dd] text-sm font-medium text-white disabled:opacity-60"
              >
                {joining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Request to join
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-100 p-3 text-center">
      <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#534ab7]">
        {icon}
      </div>
      <p className="mt-2 text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}