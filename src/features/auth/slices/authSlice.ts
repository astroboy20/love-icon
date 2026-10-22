/**
 * RTK UI slice for authentication state.
 *
 * Holds the current user identity and session-expiry flag. This is UI /
 * cross-component state — the authoritative session lives in Supabase Auth
 * and is fetched via `authApi.getSession`. This slice provides a synchronous
 * snapshot that components can read without waiting for a query.
 *
 * State shape:
 *   currentUser: { id, displayName, email } | null
 *   sessionExpired: boolean
 *
 * Actions:
 *   setCurrentUser(user)   — set user info after sign-in or session restore
 *   clearSession()         — clear user info after sign-out
 *   markSessionExpired()   — flag that the session has expired (triggers redirect)
 *
 * The action type string for `markSessionExpired` MUST match the constant
 * `MARK_SESSION_EXPIRED_ACTION` in `supabaseBaseQuery.ts` to ensure the
 * base query's 401 interceptor correctly dispatches this action.
 *
 * Requirements: 6.3, 20.2, 22.8
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface CurrentUser {
  id: string;
  displayName: string;
  email: string | null;
}

interface AuthUIState {
  currentUser: CurrentUser | null;
  sessionExpired: boolean;
  realtimeUnavailable: boolean;
}

const initialState: AuthUIState = {
  currentUser: null,
  sessionExpired: false,
  realtimeUnavailable: false,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /**
     * Store the current user's identity. Dispatched after:
     *   - A successful sign-in (Google OAuth or email/password)
     *   - App startup when a valid session is restored from storage
     *   - An `onAuthStateChange` event fires with a user
     */
    setCurrentUser: (state, action: PayloadAction<CurrentUser>) => {
      state.currentUser = action.payload;
      // Clear the expired flag when a new session is established
      state.sessionExpired = false;
    },

    /**
     * Clear all auth state. Dispatched on sign-out or when the user
     * explicitly revokes their session.
     */
    clearSession: (state) => {
      state.currentUser = null;
      state.sessionExpired = false;
    },

    /**
     * Flag that the current session has expired (HTTP 401 / PGRST301).
     * The `supabaseBaseQuery` interceptor dispatches this action by its
     * string type ("auth/markSessionExpired") to avoid a circular import.
     * Components watching `sessionExpired` can redirect the user.
     */
    markSessionExpired: (state) => {
      state.sessionExpired = true;
      state.currentUser = null;
    },

    /**
     * Flag that the Supabase real-time connection is unavailable after
     * exceeding the maximum reconnection attempts. Components can use this
     * to show a "Live updates unavailable — refresh to see latest" indicator.
     * Requirement: 18.3, 18.4
     */
    setRealtimeUnavailable: (state) => {
      state.realtimeUnavailable = true;
    },

    /**
     * Clear the realtimeUnavailable flag (e.g. after a manual page refresh
     * or when a new session is established and channels are re-subscribed).
     */
    clearRealtimeUnavailable: (state) => {
      state.realtimeUnavailable = false;
    },
  },
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const { setCurrentUser, clearSession, markSessionExpired, setRealtimeUnavailable, clearRealtimeUnavailable } = authSlice.actions;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectCurrentUser = (state: RootState) => state.auth.currentUser;
export const selectIsAuthenticated = (state: RootState) => state.auth.currentUser !== null;
export const selectSessionExpired = (state: RootState) => state.auth.sessionExpired;
export const selectRealtimeUnavailable = (state: RootState) => state.auth.realtimeUnavailable;

// ---------------------------------------------------------------------------
// Reducer (named export for store wiring)
// ---------------------------------------------------------------------------

export const authReducer = authSlice.reducer;
