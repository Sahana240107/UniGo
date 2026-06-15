"use client";

import { useState } from "react";
import Link from "next/link";
import { communityService } from "@/lib/community/service";
import { getCommunities, getToken, getUser, getDriverProfile, saveSession } from "@/utils/storage";

interface CommunityType {
  value: string;
  label: string;
}

interface PreviewData {
  name: string;
  type: string;
  member_count: number;
}

interface CreatedData {
  name: string;
  inviteCode: string;
}

interface JoinedData {
  name: string;
  inviteCode: string;
}

const COMMUNITY_TYPES: CommunityType[] = [
  { value: "apartment",    label: "🏢 Apartment / Gated community" },
  { value: "neighborhood", label: "🏘️ Neighbourhood / Street" },
  { value: "other",        label: "👋 Friend group / Other" },
];

export default function TrustCirclePage() {
  const [tab, setTab] = useState<"join" | "create">("join");

  // Join state
  const [inviteCode,    setInviteCode]    = useState("");
  const [preview,       setPreview]       = useState<PreviewData | null>(null);
  const [previewing,    setPreviewing]    = useState(false);
  const [previewError,  setPreviewError]  = useState("");
  const [joining,       setJoining]       = useState(false);
  const [joined,        setJoined]        = useState<JoinedData | null>(null);
  const [joinError,     setJoinError]     = useState("");

  // Create state
  const [groupName,    setGroupName]    = useState("");
  const [groupType,    setGroupType]    = useState("apartment");
  const [groupCity,    setGroupCity]    = useState("");
  const [groupDesc,    setGroupDesc]    = useState("");
  const [creating,     setCreating]     = useState(false);
  const [created,      setCreated]      = useState<CreatedData | null>(null);
  const [createError,  setCreateError]  = useState("");
  const [copied,       setCopied]       = useState(false);

  const handlePreview = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) return;
    setPreviewing(true);
    setPreview(null);
    setPreviewError("");
    try {
      const res = await communityService.preview(code);
      setPreview({
        name:         res.community.name,
        type:         res.community.type,
        member_count: res.member_count,
      });
    } catch (err: unknown) {
      setPreviewError(
        (err as Error)?.message ?? "That invite code was not found. Check and try again."
      );
    } finally {
      setPreviewing(false);
    }
  };

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    setJoining(true);
    setJoinError("");
    try {
      const res = await communityService.join(code);
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
      setJoined({ name: res.community.name, inviteCode: code });
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("Already a member")) {
        setJoined({ name: preview?.name ?? "the community", inviteCode: code });
      } else {
        setJoinError(msg || "Something went wrong.");
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async () => {
    if (groupName.trim().length < 3) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await communityService.create({
        name:        groupName.trim(),
        type:        groupType,
        city:        groupCity.trim() || undefined,
        description: groupDesc.trim() || undefined,
      });
      // Persist created community to localStorage so commute-flow can read it
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
      setCreated({ name: res.community.name, inviteCode: res.invite_code });
    } catch (err: unknown) {
      setCreateError((err as Error)?.message ?? "Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getShareText = () =>
    `Join my TrustCircle "${created?.name}" on UniGo!\nUse invite code: ${created?.inviteCode}\n\nWe'll be matched together for carpooling. 🚗`;

  // — Success: joined —
  if (joined) {
    return (
      <main className="min-h-screen bg-[#F8F7FF] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#1A1A2E] mb-3">You're in!</h2>
          <p className="text-[14px] text-[#6B6B8A] leading-relaxed mb-6">
            You've joined{" "}
            <span className="font-extrabold text-[#6C63FF]">{joined.name}</span>.
            <br />
            You'll be matched with members of this TrustCircle when carpooling.
          </p>
          <Link
            href="/community"
            className="inline-block bg-[#6C63FF] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#4B44CC] transition-colors"
          >
            Done →
          </Link>
        </div>
      </main>
    );
  }

  // — Success: created —
  if (created) {
    return (
      <main className="min-h-screen bg-[#F8F7FF] px-5 py-10">
        <div className="mx-auto max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-extrabold text-[#1A1A2E] mb-3">TrustCircle Created!</h2>
          <p className="text-[14px] text-[#6B6B8A] leading-relaxed mb-6">
            Share the invite code below with people you want to carpool with.
          </p>

          <div className="bg-[#EAE8FF] border-2 border-[#6C63FF] rounded-2xl p-6 mb-5">
            <p className="text-[11px] font-extrabold text-[#6C63FF] tracking-widest mb-2">
              INVITE CODE
            </p>
            <p className="text-5xl font-black text-[#6C63FF] tracking-[0.3em] mb-1">
              {created.inviteCode}
            </p>
            <p className="text-[13px] text-[#6B6B8A] font-semibold">{created.name}</p>
          </div>

          <div className="flex gap-3 justify-center mb-6">
            <button
              onClick={handleCopyCode}
              className="flex-1 bg-[#6C63FF] text-white font-bold py-3 rounded-xl hover:bg-[#4B44CC] transition-colors"
            >
              {copied ? "✓ Copied!" : "📋 Copy code"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={() =>
                  navigator.share({ title: "UniGo TrustCircle Invite", text: getShareText() })
                }
                className="flex-1 bg-white border border-[#E5E4F0] text-[#6C63FF] font-bold py-3 rounded-xl hover:bg-[#EAE8FF] transition-colors"
              >
                📤 Share
              </button>
            )}
          </div>

          <div className="bg-white border border-[#E5E4F0] rounded-xl p-4 text-left mb-6">
            <p className="text-[13px] font-bold text-[#1A1A2E] mb-3">How it works</p>
            {[
              "People you share the code with join your TrustCircle",
              "When searching for rides, you can filter to match only within your circle",
              "No group chat or member list — just smarter carpool matching",
            ].map((item, i) => (
              <p key={i} className="text-[13px] text-[#6B6B8A] leading-relaxed mb-1.5">
                • {item}
              </p>
            ))}
          </div>

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
          <div className="text-4xl mb-3">👥</div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">TrustCircle</h1>
          <p className="text-[14px] text-[#6B6B8A] leading-relaxed">
            Join a private circle using an invite code from someone you know, or create your own
            circle and share the code with people you trust.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white border border-[#E5E4F0] rounded-xl p-1 mb-5">
          {(["join", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[13px] font-semibold rounded-[9px] transition-all ${
                tab === t
                  ? "bg-[#6C63FF] text-white shadow-sm"
                  : "text-[#6B6B8A] hover:text-[#1A1A2E]"
              }`}
            >
              {t === "join" ? "Join with Code" : "Create New Circle"}
            </button>
          ))}
        </div>

        {/* JOIN TAB */}
        {tab === "join" && (
          <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5">
            <p className="text-[13px] font-semibold text-[#6B6B8A] mb-3">
              Enter the invite code you received
            </p>
            <div className="flex gap-2.5 mb-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setPreview(null);
                  setPreviewError("");
                }}
                placeholder="e.g. A3B7K2"
                maxLength={8}
                className="flex-1 border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-xl font-bold text-[#1A1A2E] bg-[#F8F7FF] tracking-[0.3em] text-center focus:outline-none focus:border-[#6C63FF]"
              />
              <button
                onClick={handlePreview}
                disabled={inviteCode.trim().length < 4 || previewing}
                className="bg-[#6C63FF] text-white font-bold px-4 rounded-xl hover:bg-[#4B44CC] disabled:opacity-40 transition-colors"
              >
                {previewing ? "..." : "Look up"}
              </button>
            </div>

            {previewError && (
              <p className="text-[13px] text-[#EF4444] mb-3">{previewError}</p>
            )}

            {preview && (
              <div className="bg-[#EAE8FF] border border-[#6C63FF]/40 rounded-xl p-4 mb-3">
                <p className="text-[13px] font-bold text-[#22C55E] mb-1">✅ Found!</p>
                <p className="text-[17px] font-extrabold text-[#1A1A2E] mb-1">{preview.name}</p>
                <p className="text-[13px] text-[#6B6B8A] mb-4">
                  {preview.type.charAt(0).toUpperCase() + preview.type.slice(1)} ·{" "}
                  {preview.member_count} member{preview.member_count !== 1 ? "s" : ""}
                </p>
                {joinError && (
                  <p className="text-[13px] text-[#EF4444] mb-2">{joinError}</p>
                )}
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full bg-[#F59E0B] text-white font-bold py-3 rounded-xl hover:bg-[#d97706] disabled:opacity-40 transition-colors"
                >
                  {joining ? "Joining…" : "Join this TrustCircle →"}
                </button>
              </div>
            )}

            <p className="text-[12px] text-[#A0A0B8] leading-relaxed">
              Ask the person who invited you to share their UniGo invite code.
            </p>
          </div>
        )}

        {/* CREATE TAB */}
        {tab === "create" && (
          <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#6B6B8A] mb-2">
                Group name *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Sunrise Apartments Block B"
                maxLength={60}
                className="w-full border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] bg-[#F8F7FF] focus:outline-none focus:border-[#6C63FF]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#6B6B8A] mb-2">Type</label>
              <div className="space-y-2">
                {COMMUNITY_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupType(opt.value)}
                    className={`w-full text-left border-[1.5px] rounded-xl px-4 py-2.5 text-[14px] transition-colors ${
                      groupType === opt.value
                        ? "border-[#6C63FF] bg-[#EAE8FF] text-[#6C63FF] font-bold"
                        : "border-[#E5E4F0] bg-[#F8F7FF] text-[#6B6B8A] hover:border-[#6C63FF]/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#6B6B8A] mb-2">
                City (optional)
              </label>
              <input
                type="text"
                value={groupCity}
                onChange={(e) => setGroupCity(e.target.value)}
                placeholder="e.g. Chennai"
                maxLength={40}
                className="w-full border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] bg-[#F8F7FF] focus:outline-none focus:border-[#6C63FF]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#6B6B8A] mb-2">
                Description (optional)
              </label>
              <textarea
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="Help members know who this group is for…"
                maxLength={200}
                rows={3}
                className="w-full border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] bg-[#F8F7FF] focus:outline-none focus:border-[#6C63FF] resize-none"
              />
            </div>

            {createError && <p className="text-[13px] text-[#EF4444]">{createError}</p>}

            <button
              onClick={handleCreate}
              disabled={groupName.trim().length < 3 || creating}
              className="w-full bg-[#6C63FF] text-white font-bold py-3.5 rounded-xl hover:bg-[#4B44CC] disabled:opacity-40 transition-colors"
            >
              {creating ? "Creating…" : "Generate Invite Code →"}
            </button>

            <p className="text-[12px] text-[#A0A0B8] leading-relaxed text-center">
              Invite codes can be shared with anyone you trust. Only people with the code can join.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}