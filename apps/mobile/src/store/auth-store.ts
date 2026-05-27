import { create } from "zustand";

import type { SamasamaUserDto } from "@samasama/shared";

type AuthStoreState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SamasamaUserDto | null;
  isAuthenticating: boolean;
  authError: string | null;
  setAuthenticating: (value: boolean) => void;
  setAuthError: (message: string | null) => void;
  setSession: (input: {
    accessToken: string;
    refreshToken: string;
    user: SamasamaUserDto;
  }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticating: false,
  authError: null,
  setAuthenticating: (value) => {
    set({ isAuthenticating: value });
  },
  setAuthError: (message) => {
    set({ authError: message });
  },
  setSession: ({ accessToken, refreshToken, user }) => {
    set({
      accessToken,
      refreshToken,
      user,
      authError: null,
      isAuthenticating: false
    });
  },
  clearSession: () => {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      authError: null,
      isAuthenticating: false
    });
  }
}));
