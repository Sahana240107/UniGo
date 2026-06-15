'use client';

/**
 * AuthContext.tsx — Web (Next.js) version.
 * Provides user, communities, driverProfile, and session helpers.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { restoreSession, signOut as authSignOut } from '../lib/authService';
import { getUser, getCommunities, getDriverProfile, saveSession } from '../utils/storage';

interface AuthState {
  user: any | null;
  communities: any[];
  driverProfile: any | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  setSession: (user: any, communities: any[], driverProfile?: any | null) => void;
  setDriverProfile: (dp: any) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    communities: [],
    driverProfile: null,
    isLoading: true,
  });

  // On mount: restore from localStorage then verify with server
  useEffect(() => {
    const cached = getUser();
    if (cached) {
      setState({
        user: cached,
        communities: getCommunities(),
        driverProfile: getDriverProfile(),
        isLoading: true,
      });
    }

    restoreSession()
      .then((result) => {
        if (result) {
          setState({
            user: result.user,
            communities: result.communities,
            driverProfile: result.driverProfile,
            isLoading: false,
          });
        } else {
          setState({ user: null, communities: [], driverProfile: null, isLoading: false });
        }
      })
      .catch(() => {
        setState({ user: null, communities: [], driverProfile: null, isLoading: false });
      });
  }, []);

  const setSession = useCallback(
    (user: any, communities: any[], driverProfile: any | null = null) => {
      setState({ user, communities, driverProfile, isLoading: false });
    },
    [],
  );

  const setDriverProfile = useCallback((dp: any) => {
    setState((prev) => ({ ...prev, driverProfile: dp }));
  }, []);

  const signOut = useCallback(() => {
    authSignOut();
    setState({ user: null, communities: [], driverProfile: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setSession, setDriverProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}