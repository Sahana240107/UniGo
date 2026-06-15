"use client";

// FILE LOCATION: apps/web/src/app/rides/page.tsx
//
// "My Rides" tab — web port of the React Native RidesScreen.
//
// API CALLS USED (all via Supabase JS client):
//
//   READ  supabase.from("ride_requests")
//           .select("id, ride_id, fare_share, rides(pickup_address, dropoff_address,
//                    departure_time, status, users:driver_id(name, reliability_score),
//                    driver_profiles:driver_id(vehicle_number, vehicle_make))")
//           .eq("rider_id", USER_ID).eq("status", "accepted")
//         → active ride card (only shown if linked ride.status is scheduled/active)
//
//   READ  supabase.from("ride_requests")
//           .select("id, ride_id, status, fare_share, created_at,
//                    rides(pickup_address, dropoff_address, departure_time, users:driver_id(name))")
//           .eq("rider_id", USER_ID)
//           .in("status", ["completed","cancelled","no_show"])
//         → ride history list (feeds History modal + month/all-time stats fallback)
//
//   READ  supabase.from("impact_summary")
//           .select("total_rides, total_saved")
//           .eq("user_id", USER_ID)
//         → all-time totals (preferred source; falls back to computed history sums)
//
//   REALTIME supabase.channel(`rides_screen_${USER_ID}`)
//            .on("postgres_changes", { table: "ride_requests", filter: `rider_id=eq.${USER_ID}` })
//            .on("postgres_changes", { event: "UPDATE", table: "rides" })
//            .on("postgres_changes", { table: "impact_summary", filter: `user_id=eq.${USER_ID}` })
//         → live refresh on ride status / impact changes
//         (requires replication enabled on these tables in Supabase dashboard)
//
// TODO: replace MOCK_USER_ID with the logged-in user's id from
//       supabase.auth.getUser() once auth is wired up.

import { useState, useEffect, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import RiderTabBar from "@/components/layout/rider-tab-bar";
import Link from "next/link";
import HistoryModal, { type RideHistoryItem } from "@/components/rides/history-modal";

// ── Constants ────────────────────────────────────────────────────────────────
const MOCK_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const MONTHLY_GOAL = 15;

// ── Types ────────────────────────────────────────────────────────────────────
interface ActiveRide {
  ride_id: string;
  driver_name: string;
  driver_score: number;
  vehicle_number: string;
  vehicle_make: string;
  pickup_address: string;
  dropoff_address: string;
  fare_share: number;
  departure_time: string;
}

interface MonthStats {
  ridesThisMonth: number;
  savedThisMonth: number;
}

interface AllTimeStats {
  totalRides: number;
  totalSaved: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getETA(departureTime: string) {
  const diff = Math.max(0, Math.round((new Date(departureTime).getTime() - Date.now()) / 60000));
  return diff <= 0 ? "Arriving" : `${diff} min`;
}

function getCO2(rides: number) {
  return Math.round(rides * 0.8 * 10) / 10;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RidesPage() {
  const supabase = createSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [history, setHistory] = useState<RideHistoryItem[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats>({ ridesThisMonth: 0, savedThisMonth: 0 });
  const [allTime, setAllTime] = useState<AllTimeStats>({ totalRides: 0, totalSaved: 0 });

  const [showHistory, setShowHistory] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [eta, setEta] = useState<string | null>(null);

  // ── Fetch everything ─────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setFetchError(null);

      // 1. Active ride
      const { data: activeReq } = await supabase
        .from("ride_requests")
        .select(
          `
          id, ride_id, fare_share,
          rides (
            pickup_address, dropoff_address, departure_time, status,
            users:driver_id ( name, reliability_score ),
            driver_profiles:driver_id ( vehicle_number, vehicle_make )
          )
        `
        )
        .eq("rider_id", MOCK_USER_ID)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeReq) {
        const r: any = (activeReq as any).rides;
        if (r && ["scheduled", "active"].includes(r.status ?? "")) {
          setActiveRide({
            ride_id: (activeReq as any).ride_id,
            driver_name: r.users?.name ?? "Driver",
            driver_score: r.users?.reliability_score ?? 100,
            vehicle_number: r.driver_profiles?.vehicle_number ?? "—",
            vehicle_make: r.driver_profiles?.vehicle_make ?? "Car",
            pickup_address: r.pickup_address ?? "Pickup",
            dropoff_address: r.dropoff_address ?? "Dropoff",
            fare_share: (activeReq as any).fare_share ?? 0,
            departure_time: r.departure_time ?? new Date().toISOString(),
          });
        } else {
          setActiveRide(null);
        }
      } else {
        setActiveRide(null);
      }

      // 2. Ride history
      const { data: histRows, error: histErr } = await supabase
        .from("ride_requests")
        .select(
          `
          id, ride_id, status, fare_share, created_at,
          rides (
            pickup_address, dropoff_address, departure_time,
            users:driver_id ( name )
          )
        `
        )
        .eq("rider_id", MOCK_USER_ID)
        .in("status", ["completed", "cancelled", "no_show"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (histErr) throw new Error(histErr.message);

      const mapped: RideHistoryItem[] = (histRows ?? []).map((r: any) => ({
        id: r.id,
        pickup_address: r.rides?.pickup_address ?? "Pickup",
        dropoff_address: r.rides?.dropoff_address ?? "Dropoff",
        departure_time: r.rides?.departure_time ?? r.created_at,
        status: r.status,
        fare_paid: r.fare_share,
        driver_name: r.rides?.users?.name ?? "Driver",
      }));

      setHistory(mapped);

      // 3. Month stats — computed from history
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const completedAll = mapped.filter((h) => h.status === "completed");
      const completedMonth = completedAll.filter((h) => h.departure_time >= startOfMonth);
      const savedMonth = completedMonth.reduce((s, h) => s + (h.fare_paid ?? 0), 0);

      setMonthStats({
        ridesThisMonth: completedMonth.length,
        savedThisMonth: Math.round(savedMonth),
      });

      // 4. All-time — from impact_summary, fallback to computed
      const { data: impact } = await supabase
        .from("impact_summary")
        .select("total_rides, total_saved")
        .eq("user_id", MOCK_USER_ID)
        .maybeSingle();

      if (impact && impact.total_rides > 0) {
        setAllTime({ totalRides: impact.total_rides, totalSaved: Number(impact.total_saved) });
      } else {
        const totalSaved = completedAll.reduce((s, h) => s + (h.fare_paid ?? 0), 0);
        setAllTime({ totalRides: completedAll.length, totalSaved: Math.round(totalSaved) });
      }
    } catch (err: any) {
      console.error("RidesPage error:", err);
      setFetchError(err?.message ?? "Failed to load rides");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // ── Real-time subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    fetchAll();

    channelRef.current = supabase
      .channel(`rides_screen_${MOCK_USER_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests", filter: `rider_id=eq.${MOCK_USER_ID}` },
        () => fetchAll()
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides" }, () => fetchAll())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "impact_summary", filter: `user_id=eq.${MOCK_USER_ID}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchAll, supabase]);

  // ── Live ETA ticker for active ride ──────────────────────────────────────
  useEffect(() => {
    if (!activeRide) {
      setEta(null);
      return;
    }
    setEta(getETA(activeRide.departure_time));
    const t = setInterval(() => setEta(getETA(activeRide.departure_time)), 30000);
    return () => clearInterval(t);
  }, [activeRide]);

  const monthName = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  const pct = Math.min(100, Math.round((monthStats.ridesThisMonth / MONTHLY_GOAL) * 100));
  const remaining = Math.max(0, MONTHLY_GOAL - monthStats.ridesThisMonth);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0F4FF] md:pl-20">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          <p className="mt-3 text-sm text-gray-400">Loading your rides...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#F0F4FF] pb-28 md:pl-20">
        <div className="mx-auto max-w-lg px-5 pt-12">

          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-[#1A1A2E]">🚗 My Rides</h1>
            <p className="mt-0.5 text-sm text-gray-500">SRM TrustCircle</p>
          </div>

          {/* Error banner */}
          {fetchError && (
            <button
              onClick={() => {
                setLoading(true);
                fetchAll();
              }}
              className="mb-3 w-full rounded-xl bg-red-50 p-3 text-left text-sm text-red-700 transition hover:bg-red-100"
            >
              ⚠️ {fetchError} — tap to retry
            </button>
          )}

          {/* Action buttons */}
          <div className="mb-4 flex gap-3">
            <button
              onClick={() => setShowHistory(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-blue-600 bg-white py-3.5 text-sm font-bold text-blue-600 transition hover:bg-blue-50"
            >
              <span className="text-base">🕐</span>
              Ride history{history.length > 0 ? ` (${history.length})` : ""}
            </button>
            <Link
              href="/ridehistory/impact"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1A1A2E] py-3.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              <span className="text-base">🌿</span>
              My impact
            </Link>
          </div>

          {/* Active ride card */}
          {activeRide && (
            <div className="mb-4 rounded-3xl bg-[#1A1A2E] p-5">
              <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-[11px] font-bold tracking-wide text-green-500">ACTIVE RIDE</span>
              </div>

              <div className="mb-3.5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                  <span className="text-[13px] font-bold text-blue-600">{getInitials(activeRide.driver_name)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{activeRide.driver_name} · Driver</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {activeRide.vehicle_make} · {activeRide.vehicle_number}
                  </p>
                </div>
                <div className="rounded-full bg-white/10 px-2.5 py-1">
                  <span className="text-xs text-white/70">⭐ {activeRide.driver_score.toFixed(1)}</span>
                </div>
              </div>

              <p className="mb-4 text-base font-semibold text-white">
                {activeRide.pickup_address} → {activeRide.dropoff_address}
              </p>

              <div className="flex border-t border-white/10 pt-3.5">
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-green-500">{eta ?? getETA(activeRide.departure_time)}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">ETA</p>
                </div>
                <div className="flex-1 border-x border-white/10 text-center">
                  <p className="text-lg font-bold text-white">₹{activeRide.fare_share ?? "—"}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">Your share</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-white">Live</p>
                  <p className="mt-0.5 text-[11px] text-white/40">Tracking</p>
                </div>
              </div>
            </div>
          )}

          {/* Month card */}
          <div className="mb-4 rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-[#1A1A2E]">{monthName}</p>
                <p className="mt-0.5 text-xs text-gray-500">Your commute this month</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">₹{monthStats.savedThisMonth.toLocaleString("en-IN")}</p>
                <p className="mt-0.5 text-xs text-gray-500">saved</p>
              </div>
            </div>

            <div className="mb-4 flex gap-2.5">
              <div className="flex-1 rounded-xl bg-[#F5F7FF] p-3">
                <p className="text-xl font-bold text-[#1A1A2E]">{monthStats.ridesThisMonth}</p>
                <p className="mt-0.5 text-xs text-gray-500">🚗 Rides done</p>
              </div>
              <div className="flex-1 rounded-xl bg-[#F5F7FF] p-3">
                <p className="text-xl font-bold text-[#188038]">{getCO2(monthStats.ridesThisMonth)} kg</p>
                <p className="mt-0.5 text-xs text-gray-500">🌿 CO₂ saved</p>
              </div>
            </div>

            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] text-gray-500">Monthly goal</p>
              <p className="text-[13px] font-bold text-blue-600">
                {monthStats.ridesThisMonth} / {MONTHLY_GOAL} rides
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-blue-50">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {remaining === 0
                ? "🎉 Goal reached! Amazing month!"
                : `${remaining} more ride${remaining > 1 ? "s" : ""} to hit your goal!`}
            </p>
          </div>

          {/* All-time card */}
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="mb-3.5 text-xs font-bold uppercase tracking-wide text-gray-500">🏆 All time savings</p>
            <div className="flex">
              <div className="flex-1 text-center">
                <p className="text-[28px] font-bold text-blue-600">₹{allTime.totalSaved.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs text-gray-400">Total saved</p>
              </div>
              <div className="flex-1 border-l border-gray-100 text-center">
                <p className="text-[28px] font-bold text-[#1A1A2E]">{allTime.totalRides}</p>
                <p className="mt-1 text-xs text-gray-400">Total rides</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} history={history} />

      <RiderTabBar />
    </>
  );
}