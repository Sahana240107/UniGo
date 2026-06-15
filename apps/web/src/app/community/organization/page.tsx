"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { communityService } from "@/lib/community/service";
import { getCommunities, getToken, getUser, getDriverProfile, saveSession } from "@/utils/storage";

const POLL_INTERVAL_MS = 4000;
const PERSONAL_DOMAINS: string[] = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "icloud.com", "protonmail.com", "ymail.com", "live.com",
  "yahoo.in", "rediffmail.com",
];

type Step = "input" | "waiting" | "hunter_checking" | "done";

interface JoinedOrg {
  email: string;
  orgName: string;
}

interface HunterResponse {
  valid: boolean;
  message?: string;
  org_name: string;
  org_type: string;
  domain: string;
}

interface VerifyResponse {
  verified: boolean;
}

const isValidEmail = (val: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

/** Get the current Firebase ID token (works for both idToken and custom token sign-in). */
async function getFirebaseToken(): Promise<string | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) return await user.getIdToken();
  } catch {
    // ignore
  }
  return typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
}

/** Authenticated fetch to our own Next.js API routes. */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getFirebaseToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

export default function OrgVerifyPage() {
  const [email, setEmail] = useState<string>("");
  const [step, setStep] = useState<Step>("input");
  const [sending, setSending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [joinedOrgs, setJoinedOrgs] = useState<JoinedOrg[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [inputError, setInputError] = useState<string>("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);
  const currentEmailRef = useRef<string>("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const stopPolling = (): void => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleSendVerification = async (): Promise<void> => {
    setInputError("");
    if (!isValidEmail(email)) {
      setInputError("Please enter a valid email address.");
      return;
    }
    const trimmed = email.trim().toLowerCase();
    const domain = trimmed.split("@")[1] ?? "";
    if (PERSONAL_DOMAINS.includes(domain)) {
      setInputError(
        "Please enter your organisation or college email, not a personal one like Gmail or Yahoo."
      );
      return;
    }
    setSending(true);
    try {
      const r = await authFetch("/api/auth/org/send-email-verification", {
        method: "POST",
        body: JSON.stringify({ email: trimmed }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData?.detail ?? errData?.message ?? "Failed to send");
      }
      currentEmailRef.current = trimmed;
      setStep("waiting");
      setResendCooldown(30);
      startPolling(trimmed);
    } catch (err) {
      setInputError(
        (err as Error)?.message ?? "Failed to send verification email. Please try again."
      );
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const startPolling = (emailToCheck: string): void => {
    stopPolling();
    pollRef.current = setInterval(() => pollVerification(emailToCheck), POLL_INTERVAL_MS);
  };

  const pollVerification = useCallback(async (emailToCheck: string): Promise<void> => {
    if (!mountedRef.current) return;
    try {
      const r = await authFetch("/api/auth/org/check-email-verified", {
        method: "POST",
        body: JSON.stringify({ email: emailToCheck }),
      });
      const res: VerifyResponse = await r.json();
      if (res.verified && mountedRef.current) {
        stopPolling();
        await proceedToHunter(emailToCheck);
      }
    } catch {
      // silent — keep polling
    }
  }, []);

  const handleManualCheck = async (): Promise<void> => {
    const emailToCheck = currentEmailRef.current;
    try {
      const r = await authFetch("/api/auth/org/check-email-verified", {
        method: "POST",
        body: JSON.stringify({ email: emailToCheck }),
      });
      const res: VerifyResponse = await r.json();
      if (res.verified) {
        stopPolling();
        await proceedToHunter(emailToCheck);
      } else {
        setStatusMsg("Not verified yet — please click the link in your email first.");
      }
    } catch (err) {
      setStatusMsg((err as Error)?.message ?? "Could not check verification status.");
    }
  };

  const proceedToHunter = async (verifiedEmail: string): Promise<void> => {
    if (!mountedRef.current) return;
    setStep("hunter_checking");
    setStatusMsg("Checking organisation domain…");
    try {
      const r = await authFetch("/api/community/verify-org-email", {
        method: "POST",
        body: JSON.stringify({ email: verifiedEmail }),
      });
      const hunterRes: HunterResponse = await r.json();

      if (!hunterRes.valid) {
        if (mountedRef.current) {
          setStep("input");
          setInputError(
            hunterRes.message ??
              "We could not confirm this as an organisation email. Please try a work or college address."
          );
        }
        return;
      }

      if (mountedRef.current) setStatusMsg(`Joining ${hunterRes.org_name} pool…`);

      const res = await communityService.joinOrCreate({
        name: hunterRes.org_name,
        type: hunterRes.org_type,
        verification_domain: hunterRes.domain,
        trust_layer: "organisation",
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

      if (mountedRef.current) {
        setJoinedOrgs((prev) => [
          ...prev,
          { email: verifiedEmail, orgName: hunterRes.org_name },
        ]);
        setStep("done");
        setEmail("");
      }
    } catch (err) {
      if (mountedRef.current) {
        if ((err as Error)?.message?.includes("Already a member")) {
          setStep("done");
          setEmail("");
        } else {
          setStep("input");
          setInputError((err as Error)?.message ?? "Organisation join failed. Please try again.");
        }
      }
    }
  };

  const handleResend = async (): Promise<void> => {
    const emailToCheck = currentEmailRef.current;
    try {
      await authFetch("/api/auth/org/send-email-verification", {
        method: "POST",
        body: JSON.stringify({ email: emailToCheck }),
      });
      setResendCooldown(30);
      setStatusMsg("New verification link sent!");
    } catch (err) {
      setStatusMsg((err as Error)?.message ?? "Failed to resend email.");
    }
  };

  const handleAddAnother = (): void => {
    setStep("input");
    setEmail("");
    setStatusMsg("");
    setInputError("");
  };

  return (
    <main className="min-h-screen bg-[#F8F7FF] px-5 py-10">
      <section className="mx-auto max-w-lg">
        <Link
          href="/community"
          onClick={stopPolling}
          className="inline-flex items-center text-[#6C63FF] font-semibold text-[15px] mb-6 hover:underline"
        >
          ‹ Back
        </Link>

        <div className="mb-6">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">
            Organisation Verification
          </h1>
          <p className="text-[14px] text-[#6B6B8A] leading-relaxed">
            Enter your work or college email. We'll send a verification link,
            then confirm the domain belongs to a real organisation using
            Hunter.io. You can verify multiple organisations.
          </p>
        </div>

        {/* Joined orgs list */}
        {joinedOrgs.length > 0 && (
          <div className="mb-4 space-y-2">
            {joinedOrgs.map((org, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-3"
              >
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-[14px] font-bold text-[#1A1A2E]">{org.orgName}</p>
                  <p className="text-[12px] text-[#6B6B8A]">{org.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP: input */}
        {step === "input" && (
          <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5">
            <p className="text-[13px] font-semibold text-[#6B6B8A] mb-2">
              {joinedOrgs.length > 0
                ? "Add another organisation email"
                : "Your organisation or college email"}
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setInputError(""); }}
              placeholder="you@yourcompany.com or you@college.edu"
              autoFocus={joinedOrgs.length === 0}
              className="w-full border-[1.5px] border-[#E5E4F0] rounded-xl px-4 py-3 text-[15px] text-[#1A1A2E] bg-[#F8F7FF] focus:outline-none focus:border-[#6C63FF] mb-1"
            />
            <p className="text-[12px] text-[#A0A0B8] mb-4">
              Don't use Gmail, Yahoo, or other personal email addresses here.
            </p>
            {inputError && (
              <p className="text-[13px] text-[#EF4444] mb-3">{inputError}</p>
            )}
            <button
              onClick={handleSendVerification}
              disabled={!isValidEmail(email) || sending}
              className="w-full bg-[#6C63FF] text-white font-bold py-3.5 rounded-xl hover:bg-[#4B44CC] disabled:opacity-40 transition-colors"
            >
              {sending ? "Sending…" : "Send Verification Email"}
            </button>
          </div>
        )}

        {/* STEP: waiting */}
        {step === "waiting" && (
          <div className="bg-white border border-[#E5E4F0] rounded-2xl p-5">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">📧</div>
              <h2 className="text-[18px] font-extrabold text-[#1A1A2E] mb-2">
                Check your email
              </h2>
              <p className="text-[14px] text-[#6B6B8A] leading-relaxed">
                We sent a verification link to
                <br />
                <span className="font-bold text-[#1A1A2E]">
                  {currentEmailRef.current}
                </span>
              </p>
            </div>

            <div className="space-y-3 mb-5">
              {[
                "Open the email we sent you",
                'Click the "Verify Email" link',
                "Come back here — we'll detect it automatically",
              ].map((st, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#6C63FF] flex items-center justify-center shrink-0">
                    <span className="text-white text-[13px] font-bold">{i + 1}</span>
                  </div>
                  <p className="text-[14px] text-[#1A1A2E]">{st}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-4 h-4 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-[#6B6B8A]">Waiting for verification…</p>
            </div>

            {statusMsg && (
              <p className="text-[13px] text-[#F59E0B] text-center mb-3">{statusMsg}</p>
            )}

            <button
              onClick={handleManualCheck}
              className="w-full bg-[#6C63FF] text-white font-bold py-3.5 rounded-xl hover:bg-[#4B44CC] transition-colors mb-3"
            >
              I've clicked the link ✓
            </button>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="w-full py-3 text-[14px] font-semibold text-[#6C63FF] hover:underline disabled:opacity-40"
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Resend verification email"}
            </button>
            <button
              onClick={() => { stopPolling(); setStep("input"); }}
              className="w-full py-2.5 text-[13px] text-[#A0A0B8] hover:underline"
            >
              ← Use a different email
            </button>
          </div>
        )}

        {/* STEP: hunter_checking */}
        {step === "hunter_checking" && (
          <div className="bg-white border border-[#E5E4F0] rounded-2xl p-8 text-center">
            <div className="w-10 h-10 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-[18px] font-extrabold text-[#1A1A2E] mb-2">
              Verifying organisation…
            </h2>
            <p className="text-[14px] text-[#6B6B8A]">{statusMsg}</p>
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && (
          <div className="bg-white border border-[#E5E4F0] rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-[18px] font-extrabold text-[#1A1A2E] mb-2">
              Organisation joined!
            </h2>
            <p className="text-[14px] text-[#6B6B8A] leading-relaxed mb-5">
              You're now in the{" "}
              <span className="font-extrabold text-[#6C63FF]">
                {joinedOrgs[joinedOrgs.length - 1]?.orgName}
              </span>{" "}
              carpool pool.
            </p>
            <button
              onClick={handleAddAnother}
              className="w-full bg-[#6C63FF] text-white font-bold py-3.5 rounded-xl hover:bg-[#4B44CC] transition-colors mb-3"
            >
              + Add another organisation
            </button>
            <Link
              href="/community"
              className="block w-full bg-[#22C55E] text-white font-bold py-3.5 rounded-xl hover:bg-[#16a34a] transition-colors text-center"
            >
              Done →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}