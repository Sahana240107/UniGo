"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle, Car, CheckCircle, Clock3,
  Loader2, MapPin, Route, Users,
} from "lucide-react";

import { getToken } from "@/utils/storage";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type RideStatus = "open" | "scheduled" | "active" | "completed" | "cancelled";

type RideTrack = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  departure_time: string;
  status: RideStatus;
  driver_name: string;
  seats_available: number;
  seats_total: number;
  women_only: boolean;
  total_fare: number;
  rider_fares: Record<string, number>;
};

const STATUS_META: Record<RideStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open:      { label: "Finding driver",  color: "text-amber-700",   bg: "bg-amber-50   border-amber-200",   icon: <Clock3 className="h-5 w-5" /> },
  scheduled: { label: "Driver assigned", color: "text-[#534ab7]",   bg: "bg-[#f9f7ff]  border-[#afa9ec]",   icon: <Car className="h-5 w-5" /> },
  active:    { label: "Ride in progress",color: "text-[#085041]",   bg: "bg-[#f0fff8]  border-[#9fe1cb]",   icon: <Route className="h-5 w-5" /> },
  completed: { label: "Completed",       color: "text-gray-700",    bg: "bg-gray-50    border-gray-200",    icon: <CheckCircle className="h-5 w-5" /> },
  cancelled: { label: "Cancelled",       color: "text-red-600",     bg: "bg-red-50     border-red-200",     icon: <AlertCircle className="h-5 w-5" /> },
};

export default function RideTrackPage() {
  const { id } = useParams<{ id: string }>();
  const [ride, setRide] = useState<RideTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRide = async () => {
    try {
      const res = await fetch(`${API_BASE}/rides/${id}`, { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
      if (!res.ok) throw new Error("Ride not found");
      setRide(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 10s when ride is open or active
  useEffect(() => {
    fetchRide();
    const interval = setInterval(() => {
      if (ride?.status === "open" || ride?.status === "active") {
        fetchRide();
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [id, ride?.status]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7f77dd]" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-sm text-red-500">
        <AlertCircle className="h-6 w-6" />
        {error ?? "Ride not found"}
      </div>
    );
  }

  const meta = STATUS_META[ride.status];

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-950">
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">

        {/* Status banner */}
        <div className={`mb-4 flex items-center gap-3 rounded-2xl border p-4 ${meta.bg}`}>
          <span className={meta.color}>{meta.icon}</span>
          <div>
            <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
            {ride.status === "open" && (
              <p className="text-xs text-amber-600 mt-0.5">
                A driver will claim your group soon. This page refreshes automatically.
              </p>
            )}
            {ride.status === "scheduled" && (
              <p className="text-xs text-[#534ab7] mt-0.5">
                Your driver is confirmed. Get ready for pickup!
              </p>
            )}
            {ride.status === "active" && (
              <p className="text-xs text-[#0f6e56] mt-0.5">
                Your driver is on the way. Stay at your pickup point.
              </p>
            )}
            {ride.status === "completed" && (
              <p className="text-xs text-gray-500 mt-0.5">
                Hope you had a great ride!
              </p>
            )}
          </div>
          {(ride.status === "open" || ride.status === "active") && (
            <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-gray-400" />
          )}
        </div>

        {/* Ride card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#534ab7]">Your ride</p>
          <div className="mt-3 grid gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1d9e75]" />
              <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d85a30]" />
              <p className="text-sm font-medium truncate">{ride.dropoff_address}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
              <Clock3 className="h-3.5 w-3.5" />
              {new Date(ride.departure_time).toLocaleTimeString([], {
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
              <Users className="h-3.5 w-3.5" />
              {ride.seats_total - ride.seats_available} rider{ride.seats_total - ride.seats_available !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Driver info — only when assigned */}
        {(ride.status === "scheduled" || ride.status === "active") && (
          <div className="mt-4 rounded-2xl border border-[#afa9ec] bg-[#f9f7ff] p-4 shadow-sm">
            <p className="text-xs font-medium text-[#534ab7]">Your driver</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7f77dd] text-sm font-semibold text-white">
                {ride.driver_name?.[0] ?? "D"}
              </div>
              <div>
                <p className="text-sm font-semibold">{ride.driver_name}</p>
                <p className="text-xs text-gray-500">Confirmed driver</p>
              </div>
            </div>
          </div>
        )}

        {/* SmartSplit */}
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#0f6e56]">SmartSplit fare</p>
          <p className="mt-1 text-2xl font-semibold text-[#1d9e75]">
            Rs. {ride.total_fare}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Split proportionally across {Object.keys(ride.rider_fares).length} rider{Object.keys(ride.rider_fares).length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Waiting state pulse */}
        {ride.status === "open" && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Waiting for a driver</p>
            <p className="mt-1 text-xs">
              Your ride group has {ride.seats_total - ride.seats_available} rider
              {ride.seats_total - ride.seats_available !== 1 ? "s" : ""}.
              Drivers in your community can see this and claim the group.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={fetchRide}
          className="mt-6 w-full text-center text-sm text-[#534ab7] underline-offset-2 hover:underline"
        >
          Refresh status
        </button>
      </div>
    </main>
  );
}