/**
 * RTK Query API slice for authentication and user profile management.
 *
 * Wraps Supabase Auth and the `profiles` table. Provides typed hooks for
 * session management, profile reads/writes, and OAuth sign-in flows.
 *
 * Tag types:
 *   "Session" — invalidated on sign-in / sign-out
 *   "Profile"  — invalidated on display name updates
 *
 * Requirements: 6.2, 6.3, 14.1, 22.4, 22.6
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { supabaseBaseQuery } from "@/lib/api/supabaseBaseQuery";
import { interceptSupabaseError } from "@/lib/api/supabaseBaseQuery";
import type { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type Profile = Tables<"profiles">;

// ---------------------------------------------------------------------------
// authApi
// ---------------------------------------------------------------------------

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: supabaseBaseQuery,
  tagTypes: ["Session", "Profile"],
  endpoints: (build) => ({
    // ------------------------------------------------------------------
    // getSession — fetch the current Supabase auth session.
    // Returns null when the user is not signed in.
    // ------------------------------------------------------------------
    getSession: build.query<Session | null, void>({
      queryFn: async (_arg, { dispatch }) => {
        const { data, error } = await supabase.auth.getSession();
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: data.session };
      },
      providesTags: ["Session"],
    }),

    // ------------------------------------------------------------------
    // getProfile — fetch a user's profile row by their auth user ID.
    // ------------------------------------------------------------------
    getProfile: build.query<Profile | null, string>({
      queryFn: async (userId, { dispatch }) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data };
      },
      providesTags: (_result, _error, userId) => [{ type: "Profile", id: userId }],
    }),

    // ------------------------------------------------------------------
    // updateDisplayName — update the display_name for the current user.
    // Invalidates the "Profile" tag so all subscribers re-fetch.
    // ------------------------------------------------------------------
    updateDisplayName: build.mutation<Profile, { userId: string; displayName: string }>({
      queryFn: async ({ userId, displayName }, { dispatch }) => {
        const { data, error } = await supabase
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", userId)
          .select()
          .single();
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data };
      },
      invalidatesTags: (_result, _error, { userId }) => [{ type: "Profile", id: userId }],
    }),

    // ------------------------------------------------------------------
    // signInWithGoogle — initiate Google OAuth flow.
    // The caller passes the `redirectTo` URL (typically the current page)
    // so Supabase redirects back to the right location post-auth.
    // ------------------------------------------------------------------
    signInWithGoogle: build.mutation<void, { redirectTo: string }>({
      queryFn: async ({ redirectTo }, { dispatch }) => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: undefined };
      },
      invalidatesTags: ["Session"],
    }),

    // ------------------------------------------------------------------
    // signInWithEmail — sign in with email + password.
    // ------------------------------------------------------------------
    signInWithEmail: build.mutation<void, { email: string; password: string }>({
      queryFn: async ({ email, password }, { dispatch }) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: undefined };
      },
      invalidatesTags: ["Session"],
    }),

    // ------------------------------------------------------------------
    // signUpWithEmail — create a new account with email + password.
    // The display name is stored via a `profiles` upsert after sign-up
    // (or picked up by the database trigger that auto-creates profiles).
    // ------------------------------------------------------------------
    signUpWithEmail: build.mutation<
      void,
      { email: string; password: string; displayName: string }
    >({
      queryFn: async ({ email, password, displayName }, { dispatch }) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
          },
        });
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: undefined };
      },
      invalidatesTags: ["Session"],
    }),

    // ------------------------------------------------------------------
    // signOut — end the current session.
    // ------------------------------------------------------------------
    signOut: build.mutation<void, void>({
      queryFn: async (_arg, { dispatch }) => {
        const { error } = await supabase.auth.signOut();
        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: undefined };
      },
      invalidatesTags: ["Session", "Profile"],
    }),
  }),
});

export const {
  useGetSessionQuery,
  useGetProfileQuery,
  useUpdateDisplayNameMutation,
  useSignInWithGoogleMutation,
  useSignInWithEmailMutation,
  useSignUpWithEmailMutation,
  useSignOutMutation,
} = authApi;
