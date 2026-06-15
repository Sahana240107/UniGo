"use client";

import { getCommunities, getToken, getUser } from "@/utils/storage";

/**
 * commute-flow.tsx — Phase 2
 *
 * Changes vs Phase 1
 * ──────────────────
 * 1. useGeolocation() → on isComing=true: auto-detect location, reverse-geocode
 *    to readable address, allow drag-to-correct via map marker.
 * 2. Drop input → live Nominatim autocomplete (debounced 350 ms).
 *    Top-5 pills show distance + ETA computed via Haversine.
 * 3. RoutePreview → calls OpenRouteService /v2/directions with real lat/lng,
 *    draws actual road polyline, shows real distance + ETA badge.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  Car,
  Check,
  Clock3,
  Crosshair,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
  CircleUser,
  AlertCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Lazy-load map (SSR=false) ──────────────────────────────────────────────
const FreeRouteMap = dynamic(
  () => import("@/components/maps/free-route-map").then((m) => m.FreeRouteMap),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#e8f4f8]" /> }
);

// ─── Phase 2 hooks ───────────────────────────────────────────────────────────
import { useGeolocation } from "@/hooks/use-geolocation";
import type { LatLng } from "@/hooks/use-geolocation";
import { useDropAutocomplete } from "@/hooks/use-drop-autocomplete";
import type { DropSuggestion } from "@/hooks/use-drop-autocomplete";

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = "join" | "create";

type LatLngTuple = [number, number];

// ─── Types ───────────────────────────────────────────────────────────────────
type RideMatch = {
  id: string;
  driver: string;
  initials: string;
  rating: string;
  pickup: string;
  drop: string;
  time: string;
  seats: string;
  fare: string;
  match: number;
  womenOnly: boolean;
  relation: string;
};
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ─── ORS route fetching ───────────────────────────────────────────────────────
const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY ?? "";

type OrsResult = {
  polyline: LatLngTuple[];
  distanceKm: number;
  durationMin: number;
};

// Decode ORS encoded polyline (precision 5)
function decodePolyline(encoded: string, precision = 5): LatLngTuple[] {
  const factor = Math.pow(10, precision);
  const result: LatLngTuple[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result_lat = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result_lat |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result_lat & 1 ? ~(result_lat >> 1) : result_lat >> 1;

    shift = 0;
    let result_lng = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result_lng |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result_lng & 1 ? ~(result_lng >> 1) : result_lng >> 1;

    result.push([lat / factor, lng / factor]);
  }
  return result;
}

async function fetchOrsRoute(
  from: LatLng,
  to: LatLng
): Promise<OrsResult | null> {
  if (!ORS_API_KEY) return null;
  try {
    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const polyline = decodePolyline(route.geometry);
    const summary = route.summary;
    return {
      polyline,
      distanceKm: summary.distance / 1000,
      durationMin: Math.round(summary.duration / 60),
    };
  } catch {
    return null;
  }
}

// Haversine fallback when ORS key is absent
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function straightLinePolyline(a: LatLng, b: LatLng): LatLngTuple[] {
  // 5-point interpolation for a slightly curved fallback path
  const steps = 5;
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t] as LatLngTuple;
  });
}


// ─── Root component ───────────────────────────────────────────────────────────
export function CommuteFlow() {
  const [isComing, setIsComing] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("join");
  const [womenOnly, setWomenOnly] = useState(true);

  // ── Session data — all initialised to safe SSR defaults, populated client-side
  // RULE: never read localStorage in useState initialisers or inline expressions.
  //       Always start with the server-safe default and hydrate in useEffect.
  //       This prevents the SSR/client hydration mismatch.
  function resolveCommunity(c: any): { id: string; name: string } | null {
    if (!c) return null;
    // Handle all possible shapes the backend may return:
    // Shape A (direct communities row):  { id: <community_uuid>, name: "Porur", ... }
    // Shape B (community_members join):  { id: <members_row_uuid>, community_id: <community_uuid>, communities: { id, name } }
    // Shape C (flat join):               { community_id: <community_uuid>, name: "Porur" }
    //
    // Priority: c.communities?.id > c.community_id > c.id
    // (c.id on a join row is the members table row id, not the community id)
    const id: string | null =
      c.communities?.id ??   // nested join object has the real community uuid
      c.community_id ??      // flat join field
      (c.id && !c.community_id ? c.id : null) ?? // bare communities row (no community_id field)
      null;
    const name: string =
      c.communities?.name ?? // nested join
      c.name ??              // direct or flat
      "";
    return id ? { id, name } : null;
  }

  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communityName, setCommunityName] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("");
  const [impactRides, setImpactRides] = useState<number>(0);
  const [impactSaved, setImpactSaved] = useState<number>(0);
  const [trustScore, setTrustScore] = useState<number | null>(null);

  // Single useEffect to hydrate all session state from localStorage then API
  useEffect(() => {
    // Greeting from current time
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

    // User name + initials + trust score from cached session
    const user = getUser();
    const name = user?.name ?? "";
    setUserName(name);
    setUserInitials(
      name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    );
    if (user?.reliability_score != null) {
      setTrustScore(user.reliability_score);
    }

    // Community from localStorage
    const raw = getCommunities()?.[0];
    console.log("[UniGo] raw community from localStorage:", JSON.stringify(raw));
    const resolved = resolveCommunity(raw);
    console.log("[UniGo] resolved community:", resolved);
    if (resolved) {
      setCommunityId(resolved.id);
      setCommunityName(resolved.name);
      return; // have what we need, skip API call
    }

    // Fallback: fetch live from API if localStorage had no usable community
    const token = getToken();
    if (!token) return;
    fetch(`${API_BASE}/community/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list: any[] = data?.communities ?? data ?? [];
        const first = list[0] ? resolveCommunity(list[0]) : null;
        if (first) {
          setCommunityId(first.id);
          setCommunityName(first.name);
        }
      })
      .catch(() => {/* silent */});

    // Fetch impact summary (total rides + money saved)
    if (token) {
      fetch(`${API_BASE}/rides/impact`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data) return;
          setImpactRides(data.total_rides ?? 0);
          setImpactSaved(data.total_saved ?? 0);
          if (data.reliability_score != null) setTrustScore(data.reliability_score);
        })
        .catch(() => {/* silent — impact strip is non-critical */});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase 2: Pickup state ─────────────────────────────────────────────────
  const { state: geoState, retry: retryGeo } = useGeolocation();

  // Pickup coords + address — can be overridden by drag
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [pickupAddress, setPickupAddress] = useState("Detecting location…");

  // Sync from geolocation on success
  useEffect(() => {
    if (geoState.status === "success") {
      setPickupCoords(geoState.coords);
      setPickupAddress(geoState.address);
    }
  }, [geoState]);

  // User dragged the pickup pin on the map
  const handlePickupDrag = useCallback(([lat, lng]: LatLngTuple) => {
    const newCoords = { lat, lng };
    setPickupCoords(newCoords);
    // Reverse-geocode the dragged position
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "UniGo/1.0", "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((d) => {
        const a = d.address ?? {};
        const parts = [
          a.amenity ?? a.building ?? a.road ?? a.suburb ?? "",
          a.city ?? a.town ?? a.village ?? "",
        ].filter(Boolean);
        setPickupAddress(parts.join(", ") || d.display_name);
      })
      .catch(() => {
        setPickupAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      });
  }, []);

  // ── Phase 2: Drop state ───────────────────────────────────────────────────
  const [dropQuery, setDropQuery] = useState("");
  const [dropCoords, setDropCoords] = useState<LatLng | null>(null);
  const [dropLabel, setDropLabel] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { suggestions, loading: suggestLoading, search: searchDrop, clear: clearSuggestions } =
    useDropAutocomplete(pickupCoords);

  const handleDropQueryChange = (val: string) => {
    setDropQuery(val);
    setDropCoords(null); // clear previous selection
    searchDrop(val);
    setShowSuggestions(true);
  };

  const handleSuggestionSelect = (s: DropSuggestion) => {
    console.log("Selected drop:", s);
    setDropQuery(s.name);
    setDropLabel(s.name);
    setDropCoords({ lat: s.lat, lng: s.lng });
    clearSuggestions();
    setShowSuggestions(false);
  };

  // ── Phase 2: ORS route ────────────────────────────────────────────────────
  const [orsResult, setOrsResult] = useState<OrsResult | null>(null);
  const [orsLoading, setOrsLoading] = useState(false);
  const orsAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pickupCoords || !dropCoords) {
      setOrsResult(null);
      return;
    }

    setOrsLoading(true);
    orsAbort.current?.abort();
    orsAbort.current = new AbortController();

    fetchOrsRoute(pickupCoords, dropCoords).then((result) => {
      setOrsResult(result);
      setOrsLoading(false);
    });
  }, [pickupCoords, dropCoords]);

  // Derived polyline (ORS or straight-line fallback)
  const polyline = useMemo<LatLngTuple[]>(() => {
    if (orsResult) return orsResult.polyline;
    if (pickupCoords && dropCoords) return straightLinePolyline(pickupCoords, dropCoords);
    return [];
  }, [orsResult, pickupCoords, dropCoords]);

  const distanceLabel = useMemo(() => {
    if (orsResult) return `${orsResult.distanceKm.toFixed(1)} km`;
    if (pickupCoords && dropCoords) {
      const km = haversineKm(pickupCoords, dropCoords);
      return `~${km.toFixed(1)} km`;
    }
    return null;
  }, [orsResult, pickupCoords, dropCoords]);

  const etaLabel = useMemo(() => {
    if (orsResult) return `${orsResult.durationMin} min`;
    if (pickupCoords && dropCoords) {
      const km = haversineKm(pickupCoords, dropCoords);
      return `~${Math.round((km / 30) * 60)} min`;
    }
    return null;
  }, [orsResult, pickupCoords, dropCoords]);
  // ── Live ride matches from backend ────────────────────────────────────────
const [matches, setMatches] = useState<RideMatch[]>([]);
const [matchesLoading, setMatchesLoading] = useState(false);
const [matchesError, setMatchesError] = useState<string | null>(null);

useEffect(() => {
  if (!pickupCoords || !dropCoords) {
    setMatches([]);
    return;
  }

  if (!communityId) {
    setMatchesError("You must be in a community to find rides.");
    setMatchesLoading(false);
    return;
  }

  setMatchesLoading(true);
  setMatchesError(null);

  const token = getToken();
  fetch(`${API_BASE}/rides/matches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      drop_lat: dropCoords.lat,
      drop_lng: dropCoords.lng,
      community_id: communityId,
      women_only: womenOnly,
    }),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    })
    .then((raw: any) => {
  // Normalize: backend may return {matches:[]} or {rides:[]} or [] directly
  const data: any[] = Array.isArray(raw)
    ? raw
    : raw.matches ?? raw.rides ?? raw.results ?? raw.data ?? [];

  setMatches(
    data.map((r) => ({
      id: r.id,
      driver: r.driver_name ?? "Unknown",
      initials: (r.driver_name ?? "??")
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      rating: String(r.driver_rating ?? "—"),
      pickup: r.pickup_address ?? "",
      drop: r.dropoff_address ?? "",
      time: r.departure_time
        ? new Date(r.departure_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      seats: `${r.seats_available} seat${r.seats_available !== 1 ? "s" : ""} left`,
      fare: r.fare_share != null ? `Rs. ${Math.round(r.fare_share)}` : "—",
      match: r.match_percent ?? 0,
      womenOnly: r.women_only ?? false,
      relation: r.route_relation ?? "Route overlap",
    }))
  );
})
    .catch((e) => setMatchesError(`Could not load matches: ${e.message}`))
    .finally(() => setMatchesLoading(false));
}, [pickupCoords, dropCoords, womenOnly, communityId]);

const visibleMatches = useMemo(
  () => matches.filter((r) => !womenOnly || r.womenOnly),
  [matches, womenOnly]
);

  const pickupTuple: LatLngTuple | null = pickupCoords
    ? [pickupCoords.lat, pickupCoords.lng]
    : null;
  const dropTuple: LatLngTuple | null = dropCoords
    ? [dropCoords.lat, dropCoords.lng]
    : null;

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-950">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:py-8">
        {/* ── Left column ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <Header communityName={communityName} greeting={greeting} userName={userName} userInitials={userInitials} />
          <DailyPulse isComing={isComing} onChange={setIsComing} />
          {isComing === true && (
            <QuickActions mode={mode} onModeChange={setMode} />
          )}
          {isComing === false && <RestDayCard />}
          <ImpactStrip rides={impactRides} saved={impactSaved} trustScore={trustScore} />
        </section>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <section className="grid gap-4">
          {isComing === true ? (
            <>
              {/* ── Pickup + Drop planner ─────────────────────────────────── */}
              <RidePlanner
                mode={mode}
                // Pickup
                pickupAddress={pickupAddress}
                geoStatus={geoState.status}
                onPickupAddressChange={setPickupAddress}
                onLocateClick={retryGeo}
                // Drop
                dropQuery={dropQuery}
                dropLabel={dropLabel}
                suggestions={suggestions}
                suggestLoading={suggestLoading}
                showSuggestions={showSuggestions}
                onDropQueryChange={handleDropQueryChange}
                onSuggestionSelect={handleSuggestionSelect}
                onDropBlur={() =>
                  setTimeout(() => setShowSuggestions(false), 150)
                }
                // Women-only
                womenOnly={womenOnly}
                onWomenOnlyChange={setWomenOnly}
              />

              {/* ── Real route preview ────────────────────────────────────── */}
              {pickupTuple && dropTuple ? (
                <RoutePreview
                  pickup={pickupTuple}
                  drop={dropTuple}
                  polyline={polyline}
                  pickupAddress={pickupAddress}
                  dropAddress={dropLabel}
                  distanceLabel={distanceLabel}
                  etaLabel={etaLabel}
                  orsLoading={orsLoading}
                  hasOrsKey={!!ORS_API_KEY}
                  onPickupDrag={handlePickupDrag}
                />
              ) : (
                <MapPlaceholder />
              )}
            {/* ── Right column content based on mode ── */}
{mode === "join" ? (
  <RiderMatches
    rides={visibleMatches}
    womenOnly={womenOnly}
    loading={matchesLoading}
    error={matchesError}
  />
) : (
  <CreateRideForm
    pickupAddress={pickupAddress}
    pickupCoords={pickupCoords}
    dropAddress={dropLabel}
    dropCoords={dropCoords}
    womenOnly={womenOnly}
    communityId={communityId}
  />
)}
</>
          ) : (
            <EmptyFlowPreview />
          )}
        </section>
      </div>
    </main>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header({
  communityName,
  greeting,
  userName,
  userInitials,
}: {
  communityName: string;
  greeting: string;
  userName: string;
  userInitials: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#534ab7]">
            {communityName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
            {greeting}, {userName}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4 text-[#1d9e75]" />
            Daily commute group active
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7f77dd] text-sm font-semibold text-white">
          {userInitials}
        </div>
      </div>
    </div>
  );
}

// ─── Daily Pulse ──────────────────────────────────────────────────────────────
function DailyPulse({
  isComing,
  onChange,
}: {
  isComing: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e4ff] bg-[#f9f7ff] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#534ab7]">
          <CalendarCheck2 className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-[#3c3489]">Are you commuting today?</p>
          <p className="text-sm text-[#6b64bd]">Your daily group is already set.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition",
            isComing === true
              ? "bg-[#7f77dd] text-white shadow-sm"
              : "border border-[#afa9ec] bg-white text-[#534ab7]"
          )}
        >
          <Check className="h-4 w-4" />
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition",
            isComing === false
              ? "bg-gray-950 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-600"
          )}
        >
          Not today
        </button>
      </div>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────
function QuickActions({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ActionButton
        active={mode === "join"}
        icon={<Search className="h-5 w-5" />}
        title="Join ride"
        description="See who is going your way"
        onClick={() => onModeChange("join")}
      />
      <ActionButton
        active={mode === "create"}
        icon={<Car className="h-5 w-5" />}
        title="Create ride"
        description="Offer seats on your route"
        onClick={() => onModeChange("create")}
        green
      />
    </div>
  );
}

function ActionButton({
  active,
  icon,
  title,
  description,
  green,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  green?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-white p-4 text-left shadow-sm transition",
        active
          ? green
            ? "border-[#9fe1cb] bg-[#f0fff8]"
            : "border-[#afa9ec] bg-[#f9f7ff]"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className={green ? "text-[#0f6e56]" : "text-[#7f77dd]"}>{icon}</div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </button>
  );
}

// ─── Ride Planner (Phase 2) ───────────────────────────────────────────────────
function RidePlanner({
  mode,
  // Pickup
  pickupAddress,
  geoStatus,
  onPickupAddressChange,
  onLocateClick,
  // Drop
  dropQuery,
  suggestions,
  suggestLoading,
  showSuggestions,
  onDropQueryChange,
  onSuggestionSelect,
  onDropBlur,
  // Women-only
  womenOnly,
  onWomenOnlyChange,
}: {
  mode: Mode;
  pickupAddress: string;
  geoStatus: string;
  onPickupAddressChange: (v: string) => void;
  onLocateClick: () => void;
  dropQuery: string;
  dropLabel: string;
  suggestions: DropSuggestion[];
  suggestLoading: boolean;
  showSuggestions: boolean;
  onDropQueryChange: (v: string) => void;
  onSuggestionSelect: (s: DropSuggestion) => void;
  onDropBlur: () => void;
  womenOnly: boolean;
  onWomenOnlyChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#534ab7]">
            {mode === "join" ? "Find a ride" : "Create a ride"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">
            Pickup and drop
          </h2>
        </div>
        <button
          type="button"
          onClick={onLocateClick}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700"
        >
          {geoStatus === "locating" ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#1d9e75]" />
          ) : (
            <LocateFixed className="h-4 w-4 text-[#1d9e75]" />
          )}
          {geoStatus === "locating" ? "Locating…" : "Current location"}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {/* ── Pickup ────────────────────────────────────── */}
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-gray-500">Pickup point</span>
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-3 transition",
              geoStatus === "error"
                ? "border-red-300 bg-red-50"
                : "border-[#afa9ec] bg-white"
            )}
          >
            {geoStatus === "locating" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1d9e75]" />
            ) : geoStatus === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            ) : (
              <Crosshair className="h-4 w-4 shrink-0 text-[#1d9e75]" />
            )}
            <input
              value={pickupAddress}
              onChange={(e) => onPickupAddressChange(e.target.value)}
              placeholder="Your pickup location"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
          </div>
          {geoStatus === "error" && (
            <p className="text-xs text-red-500">
              Could not detect location — tap &quot;Current location&quot; to retry, or type an address.
            </p>
          )}
        </label>

        {/* ── Drop (autocomplete) ───────────────────────── */}
        <div className="relative grid gap-1.5">
          <span className="text-xs font-medium text-gray-500">Drop location</span>
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-3">
            <MapPin className="h-4 w-4 shrink-0 text-[#d85a30]" />
            <input
              value={dropQuery}
              onChange={(e) => onDropQueryChange(e.target.value)}
              onBlur={onDropBlur}
              placeholder="Search destination…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
            {suggestLoading && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
            )}
          </div>

          {/* Suggestion pills */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    onMouseDown={() => onSuggestionSelect(s)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-[#f9f7ff]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-950">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {s.meta}
                      </span>
                    </span>
                    {s.eta && (
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#534ab7] ring-1 ring-[#e8e4ff]">
                        {s.eta}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Women-only toggle ──────────────────────────── */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#fbeaf0] p-3">
        <div className="flex items-center gap-2">
          <CircleUser className="h-4 w-4 text-[#993556]" />
          <div>
            <p className="text-sm font-medium text-[#7a2944]">Women only</p>
            <p className="text-xs text-[#993556]">
              {mode === "join"
                ? "Show women-only rides"
                : "Only female riders can join"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onWomenOnlyChange(!womenOnly)}
          className={cn(
            "h-6 w-11 rounded-full p-1 transition",
            womenOnly ? "bg-[#d4537e]" : "bg-gray-300"
          )}
          aria-label="Toggle women-only option"
        >
          <span
            className={cn(
              "block h-4 w-4 rounded-full bg-white transition",
              womenOnly ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ─── Route preview (Phase 2) ──────────────────────────────────────────────────
function RoutePreview({
  pickup,
  drop,
  polyline,
  pickupAddress,
  dropAddress,
  distanceLabel,
  etaLabel,
  orsLoading,
  hasOrsKey,
  onPickupDrag,
}: {
  pickup: LatLngTuple;
  drop: LatLngTuple;
  polyline: LatLngTuple[];
  pickupAddress: string;
  dropAddress: string;
  distanceLabel: string | null;
  etaLabel: string | null;
  orsLoading: boolean;
  hasOrsKey: boolean;
  onPickupDrag: (coords: LatLngTuple) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative h-72 bg-[#e8f4f8]">
        {polyline.length > 0 && (
          <FreeRouteMap
            route={polyline}
            pickup={pickup}
            drop={drop}
            onPickupDrag={onPickupDrag}
          />
        )}
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#534ab7] shadow-sm">
          {hasOrsKey ? "OpenRouteService" : "OpenStreetMap"}
        </div>
        {orsLoading ? (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Computing route…
          </div>
        ) : distanceLabel && etaLabel ? (
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
            {distanceLabel}, {etaLabel}
          </div>
        ) : null}
        {/* Drag hint */}
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/80 px-2.5 py-1 text-[10px] text-gray-500 shadow-sm backdrop-blur-sm">
          Drag green pin to correct pickup
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-3">
          <RouteLine label="Pickup" value={pickupAddress} tone="green" />
          <RouteLine label="Drop" value={dropAddress || "—"} tone="red" />
        </div>
        {!hasOrsKey && (
          <div className="rounded-xl bg-[#eaf3de] p-3 text-sm font-medium text-[#27500a]">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Straight-line estimate
            </div>
            <p className="mt-1 text-xs font-normal text-[#3b6d11]">
              Add NEXT_PUBLIC_ORS_API_KEY to draw the real road route.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div className="grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
      <div>
        <MapPin className="mx-auto mb-2 h-6 w-6 text-gray-300" />
        Enter a pickup and drop location to see the route
      </div>
    </div>
  );
}

function RouteLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "h-3 w-3 rounded-full",
          tone === "green" ? "bg-[#1d9e75]" : "bg-[#d85a30]"
        )}
      />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate text-sm font-medium text-gray-950">{value}</p>
      </div>
    </div>
  );
}

// ─── Rider matches ────────────────────────────────────────────────────────────
function RiderMatches({
  rides,
  womenOnly,
  loading,
  error,
}: {
  rides: RideMatch[];
  womenOnly: boolean;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#534ab7]">Route matches</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">
            Riders going your way
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {womenOnly ? "Women only" : "All rides"}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding rides near your route…
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && rides.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">
            No rides found on this route yet.
          </div>
        )}
        {!loading && rides.map((ride) => (
          <RideCard key={ride.id} ride={ride} />
        ))}
      </div>
    </div>
  );
}

function RideCard({ ride }: { ride: RideMatch }) {
  return (
    <article className="rounded-2xl border border-gray-200 p-3 transition hover:border-[#afa9ec] hover:bg-[#f9f7ff]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#afa9ec] text-sm font-semibold text-[#3c3489]">
            {ride.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ride.driver}</p>
            <p className="text-xs text-gray-500">Rating {ride.rating}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{ride.fare}</p>
          <p className="text-xs text-gray-500">SmartSplit</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <RouteLine label="Pickup" value={ride.pickup} tone="green" />
        <RouteLine label="Drop" value={ride.drop} tone="red" />
      </div>

      <div className="mt-3 rounded-xl bg-[#eaf3de] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#27500a]">{ride.relation}</p>
          <p className="text-xs font-semibold text-[#27500a]">{ride.match}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#7f77dd]"
            style={{ width: `${ride.match}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
          <Clock3 className="h-3.5 w-3.5" />
          {ride.time}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
          <Users className="h-3.5 w-3.5" />
          {ride.seats}
        </span>
        {ride.womenOnly && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeaf0] px-2.5 py-1 font-medium text-[#993556]">
            <CircleUser className="h-3.5 w-3.5" />
            Women only
          </span>
        )}
      </div>

      <Link
        href={`/rides/${ride.id}`}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#7f77dd] text-sm font-medium text-white"
      >
        View ride
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

// ─── Supporting small components ───────────────────────────────────────────────
function ImpactStrip({
  rides,
  saved,
  trustScore,
}: {
  rides: number;
  saved: number;
  trustScore: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat value={rides > 0 ? String(rides) : "—"} label="Rides shared" />
      <Stat value={saved > 0 ? `Rs. ${Math.round(saved)}` : "—"} label="Saved" />
      <Stat value={trustScore != null ? String(trustScore) : "—"} label="Trust score" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
      <p className="text-lg font-semibold text-[#534ab7]">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function RestDayCard() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Marked as not commuting today</p>
      <p className="mt-1">
        Your daily group will not include you in today&apos;s ride matches.
      </p>
    </div>
  );
}

function EmptyFlowPreview() {
  return (
    <div className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm">
      <div className="max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f9f7ff] text-[#534ab7]">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-normal">
          Daily commute flow
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          After the daily pulse, UniGo detects your location, lets you search a
          drop, and draws the real road route on the map.
        </p>
        <div className="mt-4 flex justify-center gap-2 text-xs font-medium text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
            <Navigation className="h-3.5 w-3.5" />
            Nominatim
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
            <Route className="h-3.5 w-3.5" />
            ORS
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
            <Shield className="h-3.5 w-3.5" />
            Safety
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Create Ride Form ─────────────────────────────────────────────────────────
function CreateRideForm({
  pickupAddress,
  pickupCoords,
  dropAddress,
  dropCoords,
  womenOnly,
  communityId,
}: {
  pickupAddress: string;
  pickupCoords: LatLng | null;
  dropAddress: string;
  dropCoords: LatLng | null;
  womenOnly: boolean;
  communityId: string | null;
}) {
  const [seats, setSeats] = useState(3);
  const [departureTime, setDepartureTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = pickupCoords && dropCoords && departureTime;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!communityId) {
      setError("You must be in a community to create a ride.");
      setLoading(false);
      return;
    }

    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/rides/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          community_id: communityId,
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          pickup_address: pickupAddress,
          dropoff_lat: dropCoords.lat,
          dropoff_lng: dropCoords.lng,
          dropoff_address: dropAddress,
          departure_time: new Date(departureTime).toISOString(),
          seats_total: seats,
          women_only: womenOnly,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? `Error ${res.status}`);
      }

      const data = await res.json();
      const rideId = data.ride?.id;
      setSuccess(rideId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-[#9fe1cb] bg-[#f0fff8] p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1d9e75] text-white">
          <Car className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-semibold text-[#085041]">
          Ride posted!
        </h2>
        <p className="mt-1 text-sm text-[#0f6e56]">
          Riders going your way will send you requests.
        </p>
        <Link
          href={`/driver/dashboard?ride_id=${success}`}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1d9e75] px-5 text-sm font-medium text-white"
        >
          Open driver dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-[#0f6e56]">Create a ride</p>
      <h2 className="mt-1 text-xl font-semibold">Offer seats on your route</h2>
      <p className="mt-1 text-xs text-gray-500">
        Post your route and let matching riders request to join you.
      </p>

      {/* Route summary */}
      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <div className="grid gap-2">
          <RouteLine
            label="Pickup"
            value={pickupAddress || "Detecting…"}
            tone="green"
          />
          <RouteLine
            label="Drop"
            value={dropAddress || "Select a destination above"}
            tone="red"
          />
        </div>
        {!dropCoords && (
          <p className="mt-2 text-xs text-amber-600">
            ↑ Search and select a drop location above first
          </p>
        )}
      </div>

      {/* Departure time */}
      <div className="mt-4 grid gap-1.5">
        <label className="text-xs font-medium text-gray-500">
          Departure time
        </label>
        <input
          type="datetime-local"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-[#7f77dd] focus:bg-white"
        />
      </div>

      {/* Seats */}
      <div className="mt-4 grid gap-1.5">
        <label className="text-xs font-medium text-gray-500">
          Seats available
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSeats((s) => Math.max(1, s - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-lg font-medium"
          >
            −
          </button>
          <span className="w-8 text-center text-lg font-semibold">{seats}</span>
          <button
            type="button"
            onClick={() => setSeats((s) => Math.min(6, s + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-lg font-medium"
          >
            +
          </button>
          <span className="text-sm text-gray-500">seats (excl. driver)</span>
        </div>
      </div>

      {/* Women only info */}
      {womenOnly && (
        <div className="mt-4 rounded-xl bg-[#fbeaf0] p-3 text-xs text-[#993556]">
          <CircleUser className="mb-1 h-4 w-4" />
          Women-only ride — only female riders can request to join.
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          {error.includes("Driver profile not active") && (
            <span className="ml-1 text-xs">
              — your driver profile needs to be active in the DB.
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={!canCreate || loading}
        className={cn(
          "mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition",
          canCreate && !loading
            ? "bg-[#1d9e75] text-white hover:bg-[#178a65]"
            : "bg-gray-100 text-gray-400"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Car className="h-4 w-4" />
        )}
        {loading ? "Posting ride…" : "Post ride"}
      </button>
    </div>
  );
}