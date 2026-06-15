"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Car, CheckCircle, Loader2, Play, Route, Users, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getToken } from "@/utils/storage";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

type RideRequest = {
  id: string;
  rider_name: string;
  pickup_address: string;
  status: string;
  fare_share: number;
};

type RideInfo = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  departure_time: string;
  seats_available: number;
  seats_total: number;
  women_only: boolean;
  status: string;
};

function DriverDashboardContent() {
  const searchParams = useSearchParams();
  const rideId = searchParams.get("ride_id");

  const [ride, setRide] = useState<RideInfo | null>(null);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!rideId) { setLoading(false); return; }
    try {
      const [rideRes, reqRes] = await Promise.all([
        fetch(`${API_BASE}/rides/${rideId}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/rides/${rideId}/requests`, { headers: authHeaders() }),
      ]);
      if (!rideRes.ok) throw new Error("Ride not found");
      setRide(await rideRes.json());
      const reqData = await reqRes.json();
      setRequests(reqData.requests ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [rideId]);

  const handleAction = async (reqId: string, status: "accepted" | "rejected") => {
    setActionLoading(reqId);
    try {
      const res = await fetch(`${API_BASE}/rides/${rideId}/request/${reqId}`, {
      headers: authHeaders(),
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Action failed");
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const accepted = requests.filter((r) => r.status === "accepted");
  const pending = requests.filter((r) => r.status === "pending");
  const totalFare = accepted.reduce((s, r) => s + r.fare_share, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7f77dd]" />
      </div>
    );
  }

  if (!rideId || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-red-500">
        <AlertCircle className="h-6 w-6" />
        {error ?? "No ride ID provided. Add ?ride_id=... to the URL."}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-950">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#534ab7]">Your ride · Driver dashboard</p>
              <h1 className="mt-1 text-xl font-semibold">
                {ride?.pickup_address} → {ride?.dropoff_address}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {ride?.departure_time
                  ? new Date(ride.departure_time).toLocaleString([], {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              {accepted.length} riders
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f9f7ff] px-3 py-1 text-xs font-medium text-[#534ab7]">
              {ride?.seats_available}/{ride?.seats_total} seats left
            </span>
            {ride?.women_only && (
              <span className="rounded-full bg-[#fbeaf0] px-3 py-1 text-xs font-medium text-[#993556]">
                Women only
              </span>
            )}
          </div>
          <Link
  href="/driver/open-rides"
  className="inline-flex items-center gap-2 rounded-xl border border-[#afa9ec] bg-[#f9f7ff] px-3 py-2 text-xs font-medium text-[#534ab7]"
>
  <Car className="h-3.5 w-3.5" />
  Browse open rides
</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">

          {/* Left column */}
          <div className="grid gap-4">

            {/* RouteMorph banner */}
            {accepted.length > 0 && (
              <div className="flex gap-3 rounded-2xl border border-[#afa9ec] bg-[#f9f7ff] p-3 text-sm text-[#3c3489]">
                <Route className="mt-0.5 h-5 w-5 shrink-0 text-[#534ab7]" />
                <p>
                  <span className="font-semibold">RouteMorph updated your route. </span>
                  Optimised stop order: {accepted.map((r) => r.rider_name).join(" → ")} → Destination
                </p>
              </div>
            )}

            {/* Pending requests */}
            {pending.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm font-semibold text-amber-800">
                  Pending requests ({pending.length})
                </p>
                <div className="grid gap-2">
                  {pending.map((req) => (
                    <div key={req.id} className="rounded-xl bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{req.rider_name}</p>
                          <p className="truncate text-xs text-gray-500">{req.pickup_address}</p>
                          <p className="mt-1 text-xs font-medium text-[#534ab7]">
                            SmartSplit: Rs. {Math.round(req.fare_share)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleAction(req.id, "rejected")}
                            disabled={!!actionLoading}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 disabled:opacity-50"
                          >
                            {actionLoading === req.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <XCircle className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, "accepted")}
                            disabled={!!actionLoading}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-green-200 bg-[#eaf3de] text-[#27500a] disabled:opacity-50"
                          >
                            {actionLoading === req.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <CheckCircle className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted riders */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">
                Rider pickups ({accepted.length})
              </h2>
              {accepted.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  No riders accepted yet — approve requests above.
                </p>
              ) : (
                <div className="grid gap-2">
                  {accepted.map((req, i) => (
                    <div key={req.id} className="flex items-center gap-3 rounded-xl bg-[#f9f7ff] p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7f77dd] text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{req.rider_name}</p>
                        <p className="truncate text-xs text-gray-500">{req.pickup_address}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#eaf3de] px-2 py-0.5 text-[10px] font-medium text-[#27500a]">
                        Accepted
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 
             rounded-xl bg-[#1d9e75] text-sm font-medium text-white disabled:opacity-40"
  disabled={accepted.length === 0 || ride?.status !== "scheduled"}
  onClick={async () => {
    await fetch(`${API_BASE}/rides/${rideId}/start`, { method: "PATCH", headers: authHeaders() });
    await fetchData();
  }}
>
  <Play className="h-4 w-4" />
  Start ride
</button>
            </div>
          </div>

          {/* Right column — stats + SmartSplit */}
          <div className="grid gap-4 content-start">
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <DriverStat icon={<Users className="h-4 w-4" />} value={String(accepted.length)} label="Riders" />
              <DriverStat icon={<Car className="h-4 w-4" />} value={`${ride?.seats_available ?? 0} left`} label="Seats" />
              <DriverStat icon={<Route className="h-4 w-4" />} value={`Rs. ${Math.round(totalFare)}`} label="Total fare" />
            </div>

            {/* SmartSplit breakdown */}
            {accepted.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-[#27500a]">SmartSplit</p>
                <div className="grid gap-2">
                  {accepted.map((req) => (
                    <div key={req.id} className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-700">{req.rider_name}</p>
                      <p className="text-sm font-semibold text-[#1d9e75]">
                        Rs. {Math.round(req.fare_share)}
                      </p>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-gray-100 pt-2">
                    <p className="text-sm font-semibold">Total</p>
                    <p className="text-sm font-semibold text-[#1d9e75]">
                      Rs. {Math.round(totalFare)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function DriverStat({ icon, value, label }: {
  icon: React.ReactNode; value: string; label: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#f9f7ff] text-[#534ab7]">
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function DriverDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7f77dd]" />
      </div>
    }>
      <DriverDashboardContent />
    </Suspense>
  );
}