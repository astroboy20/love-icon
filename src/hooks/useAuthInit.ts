/**
 * Auth state initialization hook.
 *
 * Responsibilities:
 *   - Call `supabase.auth.getSession()` on mount to restore persisted session
 *   - Set up `onAuthStateChange` listener for sign-in/sign-out/token refresh events
 *   - Dispatch `setCurrentUser` / `clearSession` actions to authSlice
 *   - Handle cross-tab auth sync (Supabase broadcasts auth changes automatically
 *     via its built-in BroadcastChannel — no extra setup required)
 *   - Clean up subscription on unmount
 *
 * This hook should be called once at the root level of the app, inside the
 * Redux Provider but outside of any route-specific component, so that auth
 * state is initialized before any page loads.
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */
import { useEffect } from "react";
import { useAppDispatch } from "@/app/store";
import { setCurrentUser, clearSession } from "@/features/auth/slices/authSlice";
import { supabase } from "@/integrations/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * Derive a display name from a Supabase user.
 *
 * Priority:
 *   1. `user_metadata.display_name` — set during sign-up
 *   2. Email prefix — the part before `@` in the user's email address
 *   3. Fallback string `"User"` when neither is available (e.g. anonymous / OAuth
 *      provider that didn't supply an email)
 */
function deriveDisplayName(
  userMetadata: Record<string, unknown>,
  email: string | undefined
): string {
  if (typeof userMetadata["display_name"] === "string" && userMetadata["display_name"]) {
    return userMetadata["display_name"];
  }

  if (email) {
    const prefix = email.split("@")[0];
    if (prefix) return prefix;
  }

  return "User";
}

/**
 * Initialize auth state from Supabase session on app load.
 *
 * Sets up a listener for auth state changes (sign-in, sign-out, token refresh,
 * user updates). Automatically syncs auth state across browser tabs via
 * Supabase's built-in BroadcastChannel — signing out in one tab dispatches
 * `clearSession()` in all other open tabs with no extra setup.
 */
export function useAuthInit() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // -------------------------------------------------------------------------
    // Initial session restore (Req 20.1)
    // -------------------------------------------------------------------------
    // Check for an existing persisted session immediately on mount so that
    // components can read `currentUser` without waiting for the auth state
    // change event to fire.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        dispatch(
          setCurrentUser({
            id: session.user.id,
            displayName: deriveDisplayName(
              session.user.user_metadata ?? {},
              session.user.email
            ),
            email: session.user.email ?? null,
          })
        );
      }
    });

    // -------------------------------------------------------------------------
    // Auth state change listener (Req 20.2, 20.3, 20.4, 20.5)
    // -------------------------------------------------------------------------
    // `onAuthStateChange` covers:
    //   - SIGNED_IN        → user signed in (Google OAuth callback, email sign-in)
    //   - TOKEN_REFRESHED  → silent token refresh (Req 20.4 session expiry handling)
    //   - USER_UPDATED     → user profile updated (email confirmation, metadata change)
    //   - SIGNED_OUT       → explicit sign-out or session revoked (Req 20.5)
    //
    // Supabase automatically broadcasts these events to all open tabs via
    // BroadcastChannel, so cross-tab sync (Req 20.3, 20.5) works without any
    // extra setup on our side.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED → update Redux store
          dispatch(
            setCurrentUser({
              id: session.user.id,
              displayName: deriveDisplayName(
                session.user.user_metadata ?? {},
                session.user.email
              ),
              email: session.user.email ?? null,
            })
          );
        } else {
          // SIGNED_OUT or session expired → clear Redux store
          dispatch(clearSession());
        }
      }
    );

    // -------------------------------------------------------------------------
    // Cleanup (unsubscribe on unmount)
    // -------------------------------------------------------------------------
    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);
}
