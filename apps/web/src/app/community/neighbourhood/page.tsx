"use client";

import { useState } from "react";
import Link from "next/link";
import { communityService } from "@/lib/community/service";
import { getCommunities, getToken, getUser, getDriverProfile, saveSession } from "@/utils/storage";

interface GpsCoords {
  latitude: number;
  longitude: number;
}

const LOCALITIES: string[] = [
  "Velachery", "Tambaram", "Adyar", "Anna Nagar", "T. Nagar",
  "Porur", "Chromepet", "Pallavaram", "Medavakkam", "Perungudi",
  "OMR", "ECR", "Sholinganallur", "Thoraipakkam", "Perambur",
  "Egmore", "Mylapore", "Nungambakkam", "Guindy", "Kodambakkam",
  "Saidapet", "Ambattur", "Avadi", "Poonamallee", "Madipakkam",
  "White Town", "Lawspet", "Mudaliarpet", "Ariyankuppam", "Ozhukarai",
  "Villianur", "Reddiarpalayam", "Muthialpet", "Puducherry Town",
];

export default function NeighbourhoodPage() {
  const [locality,     setLocality]     = useState("");
  const [filter,       setFilter]       = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [gpsAddress,   setGpsAddress]   = useState("");
  const [gpsCoords,    setGpsCoords]    = useState<GpsCoords | null>(null);
  const [gpsError,     setGpsError]     = useState("");
  const [joining,      setJoining]      = useState(false);
  const [joined,       setJoined]       = useState(false);
  const [joinError,    setJoinError]    = useState("");

  const filtered = LOCALITIES.filter((l) =>
    l.toLowerCase().includes(filter.toLowerCase())
  );

  const getGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: GpsCoords = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setGpsCoords(coords);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.address ?? {};
          const label = [addr.suburb, addr.city_district, addr.city]
            .filter(Boolean)
            .join(", ");
          setGpsAddress(label || "Location obtained");
        } catch {
          setGpsAddress("Location obtained");
        }
        setGpsLoading(false);
      },
      () => {
        setGpsError("Could not get your location. You can still join manually.");
        setGpsLoading(false);
      }
    );
  };

  const handleJoin = async () => {
    if (!locality) return;
    setJoining(true);
    setJoinError("");
    try {
      const res = await communityService.joinOrCreate({
        name:               locality,
        type:               "neighborhood",
        trust_layer:        "locality",
        locality_confirmed: !!gpsCoords,
      });
      // Persist joined community to localStorage so commute-flow can read it
      const token = getToken();
      const user = getUser();
      const driverProfile = getDriverProfile();
      if (token && user) {
        const newCommunity = res?.community ?? res;
        const existing = getCommunities().filter(
          (c: any) => (c.id ?? c.community_id) !== (newCommunity?.id)
        );
        saveSession(token, user, [newCommunity, ...existing], driverProfile);
      }
      setJoined(true);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "";
      if (msg.includes("Already a member")) {
        setJoined(true);
      } else {
        setJoinError(msg || "Neighbourhood join failed. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  if (joined) {
    return (
      <main className="min-h-screen bg-[#F8F7FF] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-2xl font-extrabold text-[#1A1A2E] mb-3">
            Neighbourhood Joined!
          </h2>
          <p className="text-[14px] text-[#6B6B8A] leading-relaxed mb-6">
            You're now in the{" "}
            <span className="font-bold text-[#22C55E]">{locality}</span> pool.
            <br />
            Your badge starts as{" "}
            <span className="text-[#F59E0B] italic">Unconfirmed</span> and upgrades to{" "}
            <span className="text-[#22C55E] italic">Confirmed</span> automatically as your
            rides verify your location.
          </p>
          <Link
            href="/community"
            className="inline-block bg-[#22C55E] text-white font-bold px-8 py-3 rounded-xl hover:bg-[#16a34a] transition-colors"
          >
            Done →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-5 py-10">
      <section className="mx-auto max-w-lg">
        <Link
          href="/community"
          className="inline-flex items-center text-[#6C63FF] font-semibold text-[15px] mb-6 hover:underline"
        >
          ‹ Back
        </Link>

        <div className="mb-6">
          <div className="text-4xl mb-3">📍</div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">Your Neighbourhood</h1>
          <p className="text-[14px] text-[#6B6B8A] leading-relaxed">
            Select your area manually below. You can also let us use your GPS to see where you
            actually are on the map — this helps confirm your location.
          </p>
        </div>

        {/* Manual locality picker */}
        <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5 mb-4">
          <p className="text-[13px] font-semibold text-[#6B6B8A] mb-3">
            Select your neighbourhood *
          </p>

          <div className="relative">
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className="w-full flex items-center justify-between border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 bg-[#F8F7FF] text-left focus:outline-none focus:border-[#6C63FF]"
            >
              <span className={locality ? "text-[#1A1A2E] font-semibold" : "text-[#A0A0B8]"}>
                {locality || "Choose your area…"}
              </span>
              <span className="text-[#A0A0B8] text-xs">{showDropdown ? "▲" : "▼"}</span>
            </button>

            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[#E5E4F0] rounded-xl shadow-lg overflow-hidden">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search locality…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full px-4 py-3 border-b border-[#E5E4F0] text-[14px] focus:outline-none"
                />
                <div className="max-h-48 overflow-y-auto">
                  {filtered.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        setLocality(loc);
                        setShowDropdown(false);
                        setFilter("");
                      }}
                      className="w-full text-left px-4 py-2.5 text-[14px] text-[#1A1A2E] hover:bg-[#F8F7FF] border-b border-[#E5E4F0] last:border-0"
                    >
                      {loc}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="px-4 py-3 text-[13px] text-[#A0A0B8] text-center">
                      No match — try different spelling
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {locality && (
            <div className="mt-3 bg-[#DCFCE7] border border-[#BBF7D0] rounded-lg px-4 py-2.5">
              <p className="text-[13px] font-semibold text-[#166534]">📍 {locality} selected</p>
            </div>
          )}
        </div>

        {/* GPS card */}
        <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5 mb-4">
          <p className="text-[13px] font-semibold text-[#6B6B8A] mb-1">
            Confirm with GPS (optional but recommended)
          </p>
          <p className="text-[13px] text-[#A0A0B8] leading-relaxed mb-4">
            Your GPS pin helps verify that your selected area matches where you actually live.
          </p>

          {!gpsCoords && (
            <button
              onClick={getGpsLocation}
              disabled={gpsLoading}
              className="w-full bg-[#6B6B8A] text-white font-bold py-3 rounded-xl hover:bg-[#4B4B6A] disabled:opacity-40 transition-colors"
            >
              {gpsLoading ? "Getting location…" : "📡 Use my GPS location"}
            </button>
          )}

          {gpsError && <p className="text-[13px] text-[#F59E0B] mt-2">{gpsError}</p>}

          {gpsCoords && (
            <div className="space-y-3">
              <div className="bg-[#EAE8FF] rounded-xl px-4 py-3">
                <p className="text-[11px] font-bold text-[#6C63FF] mb-1">
                  📡 GPS SAYS YOU'RE NEAR:
                </p>
                <p className="text-[15px] font-semibold text-[#1A1A2E]">
                  {gpsAddress || "Location obtained"}
                </p>
              </div>

              <div className="rounded-xl overflow-hidden border border-[#E5E4F0] h-44">
                <iframe
                  title="Your location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${gpsCoords.longitude - 0.02},${gpsCoords.latitude - 0.015},${gpsCoords.longitude + 0.02},${gpsCoords.latitude + 0.015}&layer=mapnik&marker=${gpsCoords.latitude},${gpsCoords.longitude}`}
                  className="w-full h-full border-0"
                />
              </div>

              {locality && (
                <div className="bg-[#FFFBEB] border border-[#F59E0B] rounded-xl px-4 py-3">
                  <p className="text-[11px] font-bold text-[#92400E] mb-1">COMPARISON</p>
                  <p className="text-[13px] text-[#78350F] leading-relaxed">
                    You selected <strong>{locality}</strong>.
                    <br />
                    GPS shows you near{" "}
                    <strong>{gpsAddress || "your location"}</strong>.
                    <br />
                    <br />
                    If these look different, please select the correct neighbourhood above.
                  </p>
                </div>
              )}

              <button
                onClick={getGpsLocation}
                className="w-full bg-[#A0A0B8] text-white font-bold py-2.5 rounded-xl hover:bg-[#6B6B8A] transition-colors"
              >
                🔄 Refresh GPS
              </button>
            </div>
          )}
        </div>

        {joinError && <p className="text-[13px] text-[#EF4444] mb-3">{joinError}</p>}

        <button
          onClick={handleJoin}
          disabled={!locality || joining}
          className="w-full bg-[#22C55E] text-white font-bold py-3.5 rounded-xl hover:bg-[#16a34a] disabled:opacity-40 transition-colors mb-4"
        >
          {joining ? "Joining…" : locality ? `Join ${locality} pool →` : "Select a neighbourhood first"}
        </button>

        <p className="text-center text-[12px] text-[#A0A0B8] leading-relaxed">
          Your badge starts as Unconfirmed and upgrades automatically as rides verify your location.
        </p>
      </section>
    </main>
  );
}
