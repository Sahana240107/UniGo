/**
 * communityService.ts — Web client for community API.
 * Uses the shared getToken() from storage, consistent with the rest of the app.
 */

import { getToken } from "../../utils/storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("You must be logged in to perform this action.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...((options.headers as Record<string, string>) ?? {}),
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail ?? data?.message ?? "Request failed");
  }
  return data;
}

export const communityService = {
  /** Preview a TrustCircle by invite code before joining. */
  preview(inviteCode: string) {
    return apiFetch(`/community/info/${inviteCode.toUpperCase().trim()}`);
  },

  /** Join a private TrustCircle by invite code (Layer 4). */
  join(inviteCode: string) {
    return apiFetch("/community/join", {
      method: "POST",
      body: JSON.stringify({ invite_code: inviteCode.toUpperCase().trim() }),
    });
  },

  /**
   * Join-or-create an open pool community.
   * Layer 2 (organisation): backend verifies email domain matches.
   * Layer 3 (locality): self-declared, starts unconfirmed.
   */
  joinOrCreate(params: {
    name: string;
    type: string;
    trust_layer: string;
    verification_domain?: string;
    locality_confirmed?: boolean;
  }) {
    return apiFetch("/community/join-or-create", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /** Create a new private TrustCircle group (Layer 4). Returns the invite code. */
  create(params: {
    name: string;
    type: string;
    city?: string;
    description?: string;
  }) {
    return apiFetch("/community/create", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /** Get the current user's community memberships. */
  myCommunities() {
    return apiFetch("/community/my");
  },

  /** Get the list of verified institutional domains. */
  knownDomains() {
    return apiFetch("/community/known-domains");
  },
};