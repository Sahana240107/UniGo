"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import RiderTabBar from "@/components/layout/rider-tab-bar";

const TODAY = new Date().toISOString().split("T")[0];

const AVATAR_BG   = ["#EEEDFE","#E1F5EE","#FAEEDA","#FAECE7","#E6F1FB"];
const AVATAR_TEXT = ["#3C3489","#085041","#633806","#712B13","#0C447C"];

type PulseStatus = "going" | "not_going" | null;

interface CommunityMember {
  user_id:       string;
  name:          string;
  commuting:     boolean | null;
  is_returning:  boolean | null;
  checked_in_at: string | null;
  role?:         string;
  avatar_url?:   string | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

function getTimeOfDay(): "morning" | "evening" {
  return new Date().getHours() < 14 ? "morning" : "evening";
}

function getNextMatchTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  let matchH = h;
  let matchM: number;
  if (m === 0)      { matchM = 0; }
  else if (m <= 30) { matchM = 30; }
  else              { matchM = 0; matchH = h + 1; }
  const period   = matchH >= 12 ? "PM" : "AM";
  const displayH = matchH > 12 ? matchH - 12 : matchH === 0 ? 12 : matchH;
  return `${displayH}:${matchM === 0 ? "00" : "30"} ${period}`;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(iso: string | null) {
  if (!iso) return "Hasn't checked in yet";
  const d = new Date(iso);
  const h = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const period   = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `Checked in at ${displayH}:${mm} ${period}`;
}

function ProfileModal({
  member,
  index,
  onClose,
}: {
  member: CommunityMember;
  index:  number;
  onClose: () => void;
}) {
  const bg   = AVATAR_BG[index   % AVATAR_BG.length];
  const text = AVATAR_TEXT[index % AVATAR_TEXT.length];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-10"
        style={{ animation: "slideUp 0.22s ease", border: "0.5px solid #E5E5E0" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />

        <div className="mb-4 flex flex-col items-center gap-3">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold"
            style={{ backgroundColor: bg, color: text }}
          >
            {getInitials(member.name)}
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">{member.name}</p>
            <p className="text-sm text-gray-400">{member.role ?? "Student"}</p>
          </div>
        </div>

        <div className="mb-5 flex justify-center gap-3">
          {member.commuting === true  && (
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#E1F5EE", color: "#085041" }}>
              Going today
            </span>
          )}
          {member.commuting === false && (
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#F1EFE8", color: "#444441" }}>
              Not today
            </span>
          )}
          {member.commuting === null  && (
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#FAEEDA", color: "#633806" }}>
              Pending check-in
            </span>
          )}
        </div>

        <p className="mb-6 text-center text-sm text-gray-400">{formatTime(member.checked_in_at)}</p>

        <div className="flex gap-3">
          <button
            className="flex-1 rounded-xl py-3 text-sm font-semibold transition"
            style={{ background: "#EEEDFE", color: "#3C3489", border: "0.5px solid #AFA9EC" }}
            onClick={onClose}
          >
            Request Carpool
          </button>
          <button
            className="flex-1 rounded-xl py-3 text-sm font-semibold transition"
            style={{ background: "#F1EFE8", color: "#444441", border: "0.5px solid #D3D1C7" }}
            onClick={onClose}
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PulsePage() {
  const supabase = createSupabaseBrowserClient();
  const { user, communities } = useAuth();

  const userId      = user?.id ?? null;
  const communityId = communities?.[0]?.id ?? null;

  const [morningStatus,  setMorningStatus]  = useState<PulseStatus>(null);
  const [eveningStatus,  setEveningStatus]  = useState<PulseStatus>(null);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [members,        setMembers]        = useState<CommunityMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<{ member: CommunityMember; index: number } | null>(null);
  const [quickStats,     setQuickStats]     = useState({ ridesShared: 0, co2Saved: 0, totalSaved: 0 });

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const communityRef = useRef<HTMLDivElement>(null);

  const timeOfDay = getTimeOfDay();
  const matchTime = getNextMatchTime();

  const fetchMyPulse = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("daily_pulse")
      .select("commuting, is_returning")
      .eq("user_id", userId)
      .eq("date", TODAY)
      .maybeSingle();

    if (data) {
      if (data.commuting    !== null) setMorningStatus(data.commuting    ? "going" : "not_going");
      if (data.is_returning !== null) setEveningStatus(data.is_returning ? "going" : "not_going");
    }
    setLoading(false);
  }, [supabase, userId]);

  const fetchQuickStats = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("impact_summary")
      .select("total_rides, total_saved, total_co2_saved")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setQuickStats({
        ridesShared: data.total_rides ?? 0,
        co2Saved:    Number(data.total_co2_saved ?? 0),
        totalSaved:  Math.round(Number(data.total_saved ?? 0)),
      });
    }
  }, [supabase, userId]);

  const fetchCommunityPulse = useCallback(async () => {
    if (!communityId) return;
    const { data: memberRows } = await supabase
      .from("community_members")
      .select("user_id, users(name, role, avatar_url)")
      .eq("community_id", communityId);

    if (!memberRows) return;

    const userIds = memberRows.map((m: any) => m.user_id);
    const { data: pulseRows } = await supabase
      .from("daily_pulse")
      .select("user_id, commuting, is_returning, created_at")
      .eq("date", TODAY)
      .in("user_id", userIds);

    setMembers(
      memberRows.map((m: any) => {
        const pulse = pulseRows?.find((p: any) => p.user_id === m.user_id);
        return {
          user_id:       m.user_id,
          name:          m.users?.name       ?? "Member",
          role:          m.users?.role       ?? "Student",
          avatar_url:    m.users?.avatar_url ?? null,
          commuting:     pulse?.commuting    ?? null,
          is_returning:  pulse?.is_returning ?? null,
          checked_in_at: pulse?.created_at   ?? null,
        };
      })
    );
  }, [supabase, communityId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchMyPulse();
    fetchCommunityPulse();
    fetchQuickStats();

    channelRef.current = supabase
      .channel("daily_pulse_web")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_pulse",    filter: `date=eq.${TODAY}` },              () => fetchCommunityPulse())
      .on("postgres_changes", { event: "*", schema: "public", table: "impact_summary", filter: `user_id=eq.${userId}` }, () => fetchQuickStats())
      .subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [fetchMyPulse, fetchCommunityPulse, fetchQuickStats, supabase, userId]);

  const handleMorningResponse = async (going: boolean) => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("daily_pulse").upsert(
      { user_id: userId, date: TODAY, commuting: going, departure_window: matchTime },
      { onConflict: "user_id,date" }
    );
    setMorningStatus(going ? "going" : "not_going");
    setSaving(false);
    fetchCommunityPulse();
    if (going) setTimeout(() => communityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const handleEveningResponse = async (going: boolean) => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("daily_pulse").upsert(
      { user_id: userId, date: TODAY, is_returning: going, departure_window: matchTime },
      { onConflict: "user_id,date" }
    );
    setEveningStatus(going ? "going" : "not_going");
    setSaving(false);
    fetchCommunityPulse();
    if (going) setTimeout(() => communityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const myStatus      = timeOfDay === "morning" ? morningStatus : eveningStatus;
  const showCommunity = myStatus === "going";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 md:pl-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#7F77DD]" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pulse-appear { animation: fadeIn 0.28s ease; }
      `}</style>

      <div className="min-h-screen bg-gray-50 md:pl-20">
        <div className="mx-auto max-w-lg px-4 pb-10 pt-6">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="mb-5">
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-0.5">UniGo</p>
            <p className="text-xl font-semibold text-gray-900">{getGreeting()}, {user?.name?.split(" ")[0] ?? "there"}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>

          {/* ── Morning Pulse Card ──────────────────────────────── */}
          {timeOfDay === "morning" && (
            <div
              className="mb-4 rounded-2xl bg-white p-5"
              style={{ border: "0.5px solid #B5D4F4", borderLeft: "3px solid #378ADD" }}
            >
              <p className="mb-1 text-[11px] font-semibold tracking-widest uppercase" style={{ color: "#185FA5" }}>
                Morning commute
              </p>
              <p className="mb-0.5 text-base font-semibold text-gray-900">Are you commuting today?</p>
              <p className="mb-5 text-sm text-gray-400">
                Carpool matched at{" "}
                <span className="font-semibold" style={{ color: "#185FA5" }}>{matchTime}</span>
              </p>

              {morningStatus === null && (
                <div className="flex gap-3">
                  <button
                    disabled={saving}
                    onClick={() => handleMorningResponse(true)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold transition disabled:opacity-50"
                    style={{ background: "#E6F1FB", color: "#0C447C", border: "0.5px solid #85B7EB" }}
                  >
                    <span className="text-xl">🚗</span>
                    Yes, I'm in!
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => handleMorningResponse(false)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold transition disabled:opacity-50"
                    style={{ background: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid #D3D1C7" }}
                  >
                    <span className="text-xl">🏠</span>
                    Not today
                  </button>
                </div>
              )}

              {morningStatus === "going" && (
                <div className="pulse-appear flex flex-col items-center py-1 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-sm font-semibold" style={{ background: "#E6F1FB", color: "#0C447C" }}>
                    <span>🚗</span> You're commuting today!
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">Carpool matched at {matchTime}</p>
                  <button onClick={() => setMorningStatus(null)} className="mt-3 text-xs underline" style={{ color: "#378ADD" }}>
                    Change response
                  </button>
                </div>
              )}

              {morningStatus === "not_going" && (
                <div className="pulse-appear flex flex-col items-center py-1 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-sm font-semibold" style={{ background: "#F1EFE8", color: "#444441" }}>
                    <span>🏠</span> Staying home today
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">Your carpool group has been notified</p>
                  <button onClick={() => setMorningStatus(null)} className="mt-3 text-xs underline" style={{ color: "#378ADD" }}>
                    Change response
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Evening Pulse Card ──────────────────────────────── */}
          {timeOfDay === "evening" && (
            <div
              className="mb-4 rounded-2xl bg-white p-5"
              style={{ border: "0.5px solid #FAC775", borderLeft: "3px solid #EF9F27" }}
            >
              <p className="mb-1 text-[11px] font-semibold tracking-widest uppercase" style={{ color: "#854F0B" }}>
                Evening return
              </p>
              <p className="mb-0.5 text-base font-semibold text-gray-900">Are you heading back home?</p>
              <p className="mb-5 text-sm text-gray-400">
                Return carpool matched at{" "}
                <span className="font-semibold" style={{ color: "#BA7517" }}>{matchTime}</span>
              </p>

              {eveningStatus === null && (
                <div className="flex gap-3">
                  <button
                    disabled={saving}
                    onClick={() => handleEveningResponse(true)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold transition disabled:opacity-50"
                    style={{ background: "#FAEEDA", color: "#633806", border: "0.5px solid #FAC775" }}
                  >
                    <span className="text-xl">🏠</span>
                    Yes, heading back!
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => handleEveningResponse(false)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-4 text-sm font-semibold transition disabled:opacity-50"
                    style={{ background: "#F1EFE8", color: "#5F5E5A", border: "0.5px solid #D3D1C7" }}
                  >
                    <span className="text-xl">🏢</span>
                    Staying late
                  </button>
                </div>
              )}

              {eveningStatus === "going" && (
                <div className="pulse-appear flex flex-col items-center py-1 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-sm font-semibold" style={{ background: "#FAEEDA", color: "#633806" }}>
                    <span>🏠</span> Heading home today!
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">Return carpool matched at {matchTime}</p>
                  <button onClick={() => setEveningStatus(null)} className="mt-3 text-xs underline" style={{ color: "#BA7517" }}>
                    Change response
                  </button>
                </div>
              )}

              {eveningStatus === "not_going" && (
                <div className="pulse-appear flex flex-col items-center py-1 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-sm font-semibold" style={{ background: "#F1EFE8", color: "#444441" }}>
                    <span>🏢</span> Staying late today
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">Your group has been notified</p>
                  <button onClick={() => setEveningStatus(null)} className="mt-3 text-xs underline" style={{ color: "#BA7517" }}>
                    Change response
                  </button>
                </div>
              )}
            </div>
          )}
          {/* ── Quick stats ─────────────────────────────────────── */}
          <div
            className="mb-4 grid grid-cols-3 divide-x rounded-2xl bg-white py-4"
            style={{ border: "0.5px solid #E5E5E0" }}
          >
            <div className="text-center px-2">
              <p className="text-lg font-semibold" style={{ color: "#185FA5" }}>{quickStats.ridesShared}</p>
              <p className="mt-0.5 text-xs text-gray-400">Rides shared</p>
            </div>
            <div className="text-center px-2">
              <p className="text-lg font-semibold" style={{ color: "#3B6D11" }}>{quickStats.co2Saved.toFixed(1)} kg</p>
              <p className="mt-0.5 text-xs text-gray-400">CO₂ saved</p>
            </div>
            <div className="text-center px-2">
              <p className="text-lg font-semibold text-gray-800">₹{quickStats.totalSaved.toLocaleString("en-IN")}</p>
              <p className="mt-0.5 text-xs text-gray-400">Saved</p>
            </div>
          </div>

          {/* ── Guarantee badge ─────────────────────────────────── */}
          <div
            className="mb-4 rounded-2xl bg-white p-4"
            style={{ border: "0.5px solid #C0DD97" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: "#EAF3DE" }}
              >
                🛡️
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Guaranteed Backup Match</p>
                <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                  Driver cancelled? UniGo automatically finds the next best ride so you can continue your commute without delays.
                </p>
                <div
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: "#EAF3DE", color: "#27500A" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#639922" }} />
                  Always protected
                </div>
              </div>
            </div>
          </div>

          {/* ── Community Pulse ─────────────────────────────────── */}
          {showCommunity && (
            <div
              ref={communityRef}
              className="pulse-appear mb-4 overflow-hidden rounded-2xl bg-white"
              style={{ border: "0.5px solid #E5E5E0" }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "0.5px solid #E5E5E0" }}>
                <span className="text-sm font-semibold text-gray-900">Community Pulse</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: "#EEEDFE", color: "#3C3489" }}
                >
                  {members.length} members
                </span>
              </div>
              <p className="px-4 py-2 text-xs text-gray-400">
                {timeOfDay === "morning" ? "Who's commuting today" : "Who's heading back home today"}
              </p>

              {members.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">No members found</p>
              ) : (
                members.map((m, i) => {
                  const statusVal = timeOfDay === "morning" ? m.commuting : m.is_returning;
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => setSelectedMember({ member: m, index: i })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                      style={{ borderBottom: i < members.length - 1 ? "0.5px solid #F1EFE8" : "none" }}
                    >
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        style={{ backgroundColor: AVATAR_BG[i % AVATAR_BG.length], color: AVATAR_TEXT[i % AVATAR_TEXT.length] }}
                      >
                        {getInitials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-400">{formatTime(m.checked_in_at)}</p>
                      </div>
                      {statusVal === null  && (
                        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#FAEEDA", color: "#633806" }}>Pending</span>
                      )}
                      {statusVal === true  && (
                        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#E1F5EE", color: "#085041" }}>Going</span>
                      )}
                      {statusVal === false && (
                        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#F1EFE8", color: "#5F5E5A" }}>Not today</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ── Find a Ride CTA ─────────────────────────────────── */}
          {showCommunity && (
            <div className="pulse-appear">
              <Link
                href="/commute"
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-semibold transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#E1F5EE", color: "#085041", border: "0.5px solid #5DCAA5" }}
              >
                <span className="text-base">🚗</span>
                Find a Ride
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          )}

        </div>
      </div>

      {selectedMember && (
        <ProfileModal
          member={selectedMember.member}
          index={selectedMember.index}
          onClose={() => setSelectedMember(null)}
        />
      )}
      <RiderTabBar />
    </>
  );
}
