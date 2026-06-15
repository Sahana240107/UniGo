"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  Car,
  Check,
  Clock3,
  Crosshair,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
  CircleUser
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const FreeRouteMap = dynamic(
  () => import("@/components/maps/free-route-map").then((mod) => mod.FreeRouteMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#e8f4f8]" />
  }
);

type Mode = "join" | "create";
type DropOption = {
  name: string;
  meta: string;
  eta: string;
};
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

const dropOptions: DropOption[] = [
  {
    name: "Central Library, NIT Trichy",
    meta: "Campus core, 4.8 km away",
    eta: "14 min"
  },
  {
    name: "Octagon Computer Center",
    meta: "Same main road approach",
    eta: "16 min"
  },
  {
    name: "Tiruchirappalli Junction",
    meta: "City route, high ride overlap",
    eta: "28 min"
  }
];

const rideMatches: RideMatch[] = [
  {
    id: "rv",
    driver: "Ruvanthika P",
    initials: "RV",
    rating: "4.9",
    pickup: "Gate 1, NIT Trichy",
    drop: "Central Library",
    time: "8:15 AM",
    seats: "2 seats left",
    fare: "Rs. 80",
    match: 78,
    womenOnly: true,
    relation: "Joins before your pickup, drops after your stop"
  },
  {
    id: "ak",
    driver: "Akshaya R",
    initials: "AK",
    rating: "4.8",
    pickup: "BHEL Main Gate",
    drop: "Octagon Center",
    time: "8:25 AM",
    seats: "1 seat left",
    fare: "Rs. 65",
    match: 71,
    womenOnly: true,
    relation: "Same route until campus inner road"
  },
  {
    id: "mn",
    driver: "Manoj K",
    initials: "MK",
    rating: "4.7",
    pickup: "Thuvakudi Bus Stop",
    drop: "Library Signal",
    time: "8:30 AM",
    seats: "3 seats left",
    fare: "Rs. 55",
    match: 64,
    womenOnly: false,
    relation: "Passes your pickup, ends near your drop"
  }
];

export function CommuteFlow() {
  const [isComing, setIsComing] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("join");
  const [pickup, setPickup] = useState("Gate 1, NIT Trichy");
  const [drop, setDrop] = useState(dropOptions[0].name);
  const [womenOnly, setWomenOnly] = useState(true);

  const visibleMatches = useMemo(
    () => rideMatches.filter((ride) => !womenOnly || ride.womenOnly),
    [womenOnly]
  );

  return (
    <main className="min-h-screen bg-[#f8fafc] text-gray-950">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:py-8">
        <section className="flex flex-col gap-4">
          <Header />
          <DailyPulse isComing={isComing} onChange={setIsComing} />
          {isComing === true ? (
            <QuickActions mode={mode} onModeChange={setMode} />
          ) : null}
          {isComing === false ? <RestDayCard /> : null}
          <ImpactStrip />
        </section>

        <section className="grid gap-4">
          {isComing === true ? (
            <>
              <RidePlanner
                mode={mode}
                pickup={pickup}
                drop={drop}
                womenOnly={womenOnly}
                onPickupChange={setPickup}
                onDropChange={setDrop}
                onWomenOnlyChange={setWomenOnly}
              />
              <RoutePreview pickup={pickup} drop={drop} />
              <RiderMatches rides={visibleMatches} womenOnly={womenOnly} />
            </>
          ) : (
            <EmptyFlowPreview />
          )}
        </section>
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#534ab7]">NIT Trichy TrustCircle</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
            Good morning, Sahana
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4 text-[#1d9e75]" />
            Daily commute group active
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7f77dd] text-sm font-semibold text-white">
          S
        </div>
      </div>
    </div>
  );
}

function DailyPulse({
  isComing,
  onChange
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

function QuickActions({
  mode,
  onModeChange
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
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
  onClick
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

function RidePlanner({
  mode,
  pickup,
  drop,
  womenOnly,
  onPickupChange,
  onDropChange,
  onWomenOnlyChange
}: {
  mode: Mode;
  pickup: string;
  drop: string;
  womenOnly: boolean;
  onPickupChange: (value: string) => void;
  onDropChange: (value: string) => void;
  onWomenOnlyChange: (value: boolean) => void;
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
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700"
          onClick={() => onPickupChange("Current location near Gate 1")}
        >
          <LocateFixed className="h-4 w-4 text-[#1d9e75]" />
          Current location
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-gray-500">Pickup point</span>
          <div className="flex items-center gap-2 rounded-xl border border-[#afa9ec] bg-white px-3 py-3">
            <Crosshair className="h-4 w-4 shrink-0 text-[#1d9e75]" />
            <input
              value={pickup}
              onChange={(event) => onPickupChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
          </div>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-gray-500">Drop location</span>
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-3">
            <MapPin className="h-4 w-4 shrink-0 text-[#d85a30]" />
            <input
              value={drop}
              onChange={(event) => onDropChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        {dropOptions.map((option) => (
          <button
            key={option.name}
            type="button"
            onClick={() => onDropChange(option.name)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
              drop === option.name
                ? "border-[#afa9ec] bg-[#f9f7ff]"
                : "border-gray-200 bg-white hover:bg-gray-50"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{option.name}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{option.meta}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#534ab7] ring-1 ring-[#e8e4ff]">
              {option.eta}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#fbeaf0] p-3">
        <div className="flex items-center gap-2">
          <CircleUser className="h-4 w-4 text-[#993556]" />
          <div>
            <p className="text-sm font-medium text-[#7a2944]">Women only</p>
            <p className="text-xs text-[#993556]">
              {mode === "join" ? "Show women-only rides" : "Only female riders can join"}
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

function RoutePreview({ pickup, drop }: { pickup: string; drop: string }) {
  const route: [number, number][] = [
    [10.7597, 78.8132],
    [10.7607, 78.8141],
    [10.7621, 78.8152],
    [10.7632, 78.8171],
    [10.7641, 78.8187]
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative h-72 bg-[#e8f4f8]">
        <FreeRouteMap
          route={route}
          pickup={route[0]}
          drop={route[route.length - 1]}
          car={route[2]}
        />
        <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#534ab7] shadow-sm">
          OpenStreetMap
        </div>
        <div className="absolute bottom-4 right-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
          4.8 km, 14 min
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-3">
          <RouteLine label="Pickup" value={pickup} tone="green" />
          <RouteLine label="Drop" value={drop} tone="red" />
        </div>
        <div className="rounded-xl bg-[#eaf3de] p-3 text-sm font-medium text-[#27500a]">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            Route drawn on free OSM tiles
          </div>
          <p className="mt-1 text-xs font-normal text-[#3b6d11]">
            OpenRouteService can generate exact road geometry when the API key is added.
          </p>
        </div>
      </div>
    </div>
  );
}

function RouteLine({
  label,
  value,
  tone
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

function RiderMatches({
  rides,
  womenOnly
}: {
  rides: RideMatch[];
  womenOnly: boolean;
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
        {rides.map((ride) => (
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
        {ride.womenOnly ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeaf0] px-2.5 py-1 font-medium text-[#993556]">
            <CircleUser className="h-3.5 w-3.5" />
            Women only
          </span>
        ) : null}
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

function ImpactStrip() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat value="14" label="Rides shared" />
      <Stat value="Rs. 820" label="Saved" />
      <Stat value="4.9" label="Trust score" />
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
          After the daily pulse, UniGo opens pickup correction, drop suggestions,
          free-map route preview, and route-aware rider matches.
        </p>
        <div className="mt-4 flex justify-center gap-2 text-xs font-medium text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
            <Navigation className="h-3.5 w-3.5" />
            OSM
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
