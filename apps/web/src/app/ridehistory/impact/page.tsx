"use client";

// FILE LOCATION: apps/web/src/app/rides/impact/page.tsx
//
// "My Impact" — full page version of the RN ImpactModal.
//
// API CALLS USED:
//
//   READ  supabase.from("impact_summary")
//           .select("total_rides, total_saved, total_co2_saved")
//           .eq("user_id", USER_ID)
//           .maybeSingle()
//         → primary source for totalRides / totalSaved / co2Total.
//           total_co2_saved is maintained server-side by a Postgres trigger
//           (see database/migrations — impact_summary_on_ride_completed).
//
//   READ  (fallback, if impact_summary has no row or total_rides = 0)
//         supabase.from("ride_requests")
//           .select("status, fare_share")
//           .eq("rider_id", USER_ID)
//           .eq("status", "completed")
//         → compute totals from completed rides directly
//
//   REALTIME supabase.channel(`impact_${USER_ID}`)
//            .on("postgres_changes", { table: "impact_summary", filter: `user_id=eq.${USER_ID}` })
//            .on("postgres_changes", { table: "ride_requests", filter: `rider_id=eq.${USER_ID}` })
//         → live updates: forest grows/shrinks, counters re-animate, fuel bar
//           re-fills whenever totals change (requires replication enabled)
//
// TODO: replace MOCK_USER_ID with supabase.auth.getUser() once auth is wired up.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import RiderTabBar from "@/components/layout/rider-tab-bar";
import AnimatedForest, { MAX_TREES } from "@/components/rides/animated-forest";
import { useCounter } from "@/hooks/use-counter";

// ── Constants ────────────────────────────────────────────────────────────────
const MOCK_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const CO2_PER_RIDE = 0.8;   // kg CO2 saved per shared ride vs solo cab
const FUEL_PER_KG = 0.43;   // litres of petrol per kg CO2

function getCO2(rides: number) {
  return Math.round(rides * CO2_PER_RIDE * 10) / 10;
}

export default function ImpactPage() {
  const supabase = createSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalRides, setTotalRides] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalCo2, setTotalCo2] = useState<number | null>(null); // null = not provided, fall back to computed
  const [ready, setReady] = useState(false); // gate counters until first paint

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch impact totals ────────────────────────────────────────────────────
  const fetchImpact = useCallback(async () => {
    try {
      setFetchError(null);

      const { data: impact } = await supabase
        .from("impact_summary")
        .select("total_rides, total_saved, total_co2_saved")
        .eq("user_id", MOCK_USER_ID)
        .maybeSingle();

      if (impact && impact.total_rides > 0) {
        setTotalRides(impact.total_rides);
        setTotalSaved(Number(impact.total_saved));
        setTotalCo2(impact.total_co2_saved != null ? Number(impact.total_co2_saved) : null);
        return;
      }

      // Fallback: compute from completed ride_requests
      const { data: rows, error } = await supabase
        .from("ride_requests")
        .select("status, fare_share")
        .eq("rider_id", MOCK_USER_ID)
        .eq("status", "completed");

      if (error) throw new Error(error.message);

      const completed = rows ?? [];
      setTotalRides(completed.length);
      setTotalSaved(Math.round(completed.reduce((s, r: any) => s + (r.fare_share ?? 0), 0)));
      setTotalCo2(null);
    } catch (err: any) {
      console.error("ImpactPage error:", err);
      setFetchError(err?.message ?? "Failed to load impact");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchImpact();

    channelRef.current = supabase
      .channel(`impact_${MOCK_USER_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "impact_summary", filter: `user_id=eq.${MOCK_USER_ID}` },
        () => fetchImpact()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests", filter: `rider_id=eq.${MOCK_USER_ID}` },
        () => fetchImpact()
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchImpact, supabase]);

  // Trigger counter animations shortly after data lands / changes
  useEffect(() => {
    if (loading) return;
    setReady(false);
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, [loading, totalRides, totalSaved]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const co2Total = totalCo2 ?? getCO2(totalRides);
  const fuelL = Math.round(co2Total * FUEL_PER_KG * 10) / 10;
  const phoneCharges = Math.round(co2Total * 82);
  const ledHours = Math.round(co2Total * 10);
  const kmOffset = Math.round(co2Total * 4.5);
  const treesPlanted = Math.min(totalRides, MAX_TREES);

  const co2Val = useCounter(co2Total, 1200, ready);
  const fuelVal = useCounter(fuelL, 1400, ready);
  const phoneVal = useCounter(phoneCharges, 1200, ready);
  const ledVal = useCounter(ledHours, 1200, ready);
  const kmVal = useCounter(kmOffset, 1200, ready);
  const ridesVal = useCounter(totalRides, 1200, ready);

  const fuelBarPct = ready ? Math.min(100, (fuelL / 10) * 100) : 0;

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 -z-10 bg-[#0D1B0F]" style={{ colorScheme: "dark" }} />
        <div className="flex min-h-screen items-center justify-center md:pl-20">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-green-500" />
            <p className="mt-3 text-sm text-white/40">Loading your impact...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Full-bleed dark background, scoped to this page only.
          Fixed + inset-0 guarantees no light `body` background shows
          through at the edges, independent of content height. */}
      <div className="fixed inset-0 -z-10 bg-[#0D1B0F]" style={{ colorScheme: "dark" }} />

      <div className="min-h-screen pb-28 md:pl-20" style={{ colorScheme: "dark" }}>
        <div className="mx-auto max-w-lg px-5 pt-12">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">🌍 Your impact</h1>
              <p className="mt-1 text-sm text-white/40">{totalRides} rides · all time</p>
            </div>
            <Link
              href="/rides"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm text-white/60 transition hover:bg-white/20"
              aria-label="Back to rides"
            >
              ✕
            </Link>
          </div>

          {/* Error banner */}
          {fetchError && (
            <button
              onClick={() => {
                setLoading(true);
                fetchImpact();
              }}
              className="mb-3 w-full rounded-xl bg-red-500/10 p-3 text-left text-sm text-red-300 transition hover:bg-red-500/20"
            >
              ⚠️ {fetchError} — tap to retry
            </button>
          )}

          {/* Forest card */}
          <div className="mb-3.5 rounded-2xl bg-white/[0.05] p-4">
            <p className="mb-3.5 text-[10px] tracking-widest text-white/35">YOUR FOREST — 1 RIDE = 1 TREE</p>
            <AnimatedForest count={totalRides} />
            <div className="mt-2 h-0.5 rounded-full bg-green-500/25" />
            <p className="mt-2.5 text-center text-[11px] text-white/35">
              {treesPlanted} {treesPlanted === 1 ? "tree" : "trees"} growing 🌱 keep riding to grow your forest
            </p>
          </div>

          {/* Stats row */}
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/[0.07] p-3.5">
              <p className="text-2xl font-bold text-[#34A853]">{co2Val.toFixed(1)} kg</p>
              <p className="mt-0.5 text-xs text-white/50">CO₂ saved</p>
              <p className="mt-0.5 text-[11px] text-white/25">vs solo cab</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-3.5">
              <p className="text-2xl font-bold text-white">{Math.round(ridesVal)}</p>
              <p className="mt-0.5 text-xs text-white/50">Total rides</p>
              <p className="mt-0.5 text-[11px] text-white/25">shared trips</p>
            </div>
          </div>

          {/* Fuel card */}
          <div className="mb-3.5 rounded-2xl bg-white/[0.07] p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-white/70">⛽ Petrol saved</p>
              <p className="text-xl font-bold text-[#FBBC04]">{fuelVal.toFixed(1)} L</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#FBBC04] transition-[width] duration-[1400ms] ease-out"
                style={{ width: `${fuelBarPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/30">
              equivalent to {fuelVal.toFixed(1)} litres of petrol not burned
            </p>
          </div>

          {/* Equivalents */}
          <p className="mb-2.5 text-[10px] tracking-widest text-white/30">THAT&apos;S EQUIVALENT TO...</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/[0.05] p-3 text-center">
              <p className="mb-1.5 text-xl">📱</p>
              <p className="text-[15px] font-bold text-white">{Math.round(phoneVal)}x</p>
              <p className="mt-0.5 text-[10px] text-white/35">phone charges</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] p-3 text-center">
              <p className="mb-1.5 text-xl">💡</p>
              <p className="text-[15px] font-bold text-white">{Math.round(ledVal)} hrs</p>
              <p className="mt-0.5 text-[10px] text-white/35">LED bulb powered</p>
            </div>
            <div className="rounded-xl bg-white/[0.05] p-3 text-center">
              <p className="mb-1.5 text-xl">🚗</p>
              <p className="text-[15px] font-bold text-[#FBBC04]">{Math.round(kmVal)} km</p>
              <p className="mt-0.5 text-[10px] text-white/35">car km offset</p>
            </div>
          </div>

          {/* Pledge */}
          <div className="flex items-center gap-3 rounded-2xl bg-green-500/[0.12] p-4">
            <span className="text-3xl">🏆</span>
            <p className="text-sm leading-relaxed text-white/65">
              You&apos;re a UniGo Green Rider! Every shared ride helps SRM campus breathe cleaner.
            </p>
          </div>

        </div>
      </div>

      <RiderTabBar />
    </>
  );
}