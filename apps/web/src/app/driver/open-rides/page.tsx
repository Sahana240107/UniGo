"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, Car, Clock3, Loader2, MapPin,
  Route, Users, AlertCircle, CircleUser, CheckCircle,
} from "lucide-react";

import { getToken } from "@/utils/storage";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
const DEV_COMMUNITY_ID = "00000000-0000-0000-0000-000000000001";

type Rider = { name: string; pickup_address: string };

type OpenRide = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  departure_time: string;
  seats_total: number;
  seats_available: number;
  women_only: boolean;
  rider_count: number;
  riders: Rider[];
  total_fare: number;
  distance_km: number;
};

export default function OpenRidesPage() {
  const [rides, setRides] = useState<OpenRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);

  const fetchRides = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/rides/open?community_id=${DEV_COMMUNITY_ID}`, { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRides(data.rides ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRides(); }, []);

  const handleClaim = async (rideId: string) => {
    setClaiming(rideId);
    try {
      const res = await fetch(`${API_BASE}/rides/${rideId}/claim`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Claim failed");
      }
      setClaimed(rideId);
      // Remove from list
      setRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[#534ab7]">Driver · Open rides</p>
          <h1 className="mt-1 text-2xl font-semibold">Rider groups near you</h1>
          <p className="mt-1 text-sm text-gray-500">
            These riders are looking for a driver. Claim a group to start your dashboard.
          </p>
        </div>

        {/* Claimed banner */}
        {claimed && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#9fe1cb] bg-[#f0fff8] p-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-[#1d9e75]" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#085041]">Ride claimed!</p>
              <p className="text-xs text-[#0f6e56]">Head to your dashboard to manage pickups.</p>
            </div>
            <Link
              href={`/driver/dashboard?ride_id=${claimed}`}
              className="inline-flex items-center gap-1 rounded-xl bg-[#1d9e75] px-3 py-2 text-xs font-medium text-white"
            >
              Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading open rides…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && rides.length === 0 && !claimed && (
          <div className="py-16 text-center text-sm text-gray-400">
            <Route className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            No open rides in your community yet.
          </div>
        )}

        <div className="grid gap-4">
          {rides.map((ride) => (
            <article
              key={ride.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              {/* Route */}
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1d9e75]" />
                  <p className="text-sm font-medium text-gray-950 truncate">
                    {ride.pickup_address}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#d85a30]" />
                  <p className="text-sm font-medium text-gray-950 truncate">
                    {ride.dropoff_address}
                  </p>
                </div>
              </div>

              {/* Meta row */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {new Date(ride.departure_time).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                  <Users className="h-3.5 w-3.5" />
                  {ride.rider_count} rider{ride.rider_count !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                  <Route className="h-3.5 w-3.5" />
                  {ride.distance_km} km
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f9f7ff] px-2.5 py-1 font-medium text-[#534ab7]">
                  Rs. {ride.total_fare} total
                </span>
                {ride.women_only && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeaf0] px-2.5 py-1 font-medium text-[#993556]">
                    <CircleUser className="h-3.5 w-3.5" />
                    Women only
                  </span>
                )}
              </div>

              {/* Riders list */}
              {ride.riders.length > 0 && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-500">Riders</p>
                  <div className="grid gap-1.5">
                    {ride.riders.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#afa9ec] text-[10px] font-semibold text-[#3c3489]">
                          {r.name[0]}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-gray-800">
                            {r.name}
                          </span>
                          <span className="mx-1.5 text-gray-300">·</span>
                          <span className="truncate text-xs text-gray-500">
                            {r.pickup_address}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claim button */}
              <button
                type="button"
                onClick={() => handleClaim(ride.id)}
                disabled={!!claiming}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#534ab7] text-sm font-medium text-white disabled:opacity-50 transition hover:bg-[#3c3489]"
              >
                {claiming === ride.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Car className="h-4 w-4" />
                )}
                {claiming === ride.id ? "Claiming…" : "Claim this ride"}
              </button>
            </article>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={fetchRides}
            className="text-sm text-[#534ab7] underline-offset-2 hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}