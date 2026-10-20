/**
 * RTK Query API slice for the Love of Fame feed.
 *
 * Wraps Supabase queries against `lovenotes` and `reactions` tables, plus
 * Storage uploads for note photos. Provides hooks for fetching notes,
 * publishing notes, toggling reactions, and uploading photos.
 *
 * Tag types:
 *   "Notes"     — invalidated when a new note is published
 *   "Reactions" — invalidated when a reaction is toggled
 *
 * Requirements: 3.1, 3.2, 3.5, 17.2, 17.3, 17.4, 22.4, 22.6
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseBaseQuery, interceptSupabaseError } from "@/lib/api/supabaseBaseQuery";
import { STORAGE_BUCKETS } from "@/lib/config/app";
import type { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type LoveNote = Tables<"lovenotes">;
export type Reaction = Tables<"reactions">;

/** Minimal reaction row for counting display. */
export interface ReactionRow {
  love_note_id: string;
  user_id: string;
  reaction_type: string;
}

export type LoveType = string;
export type NoteCategory = string;
export type ReactionType = string;

interface PublishNoteArgs {
  content: string;
  loveType: LoveType;
  category: NoteCategory;
  imageUrl?: string | null;
  loveCoinId?: string | null;
  authorName: string;
}

interface ToggleReactionArgs {
  noteId: string;
  reactionType: ReactionType;
  userId: string;
}

// ---------------------------------------------------------------------------
// Helper: generate unique storage path
// Format: {userId}/{timestamp}-{randomId}.{ext}
// Requirements: 3.5, 19.1, 19.2
// ---------------------------------------------------------------------------

function generateStoragePath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const ext = filename.split(".").pop() || "jpg";
  return `${userId}/${timestamp}-${randomId}.${ext}`;
}

// ---------------------------------------------------------------------------
// fameApi
// ---------------------------------------------------------------------------

export const fameApi = createApi({
  reducerPath: "fameApi",
  baseQuery: supabaseBaseQuery,
  tagTypes: ["Notes", "Reactions"],
  endpoints: (build) => ({
    // ------------------------------------------------------------------
    // getNotes — fetch LoveNotes ordered by created_at desc.
    // Supports pagination via limit/offset.
    // ------------------------------------------------------------------
    getNotes: build.query<LoveNote[], { limit?: number; offset?: number } | void>({
      queryFn: async (args, { dispatch }) => {
        const { limit = 100, offset = 0 } = args || {};
        const { data, error } = await supabase
          .from("lovenotes")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: data || [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Notes" as const, id })),
              { type: "Notes" as const },
            ]
          : [{ type: "Notes" as const }],
    }),

    // ------------------------------------------------------------------
    // getReactions — fetch all reactions (minimal columns for counting).
    // Selects only love_note_id, user_id, reaction_type to minimize payload.
    // ------------------------------------------------------------------
    getReactions: build.query<ReactionRow[], void>({
      queryFn: async (_arg, { dispatch }) => {
        const { data, error } = await supabase
          .from("reactions")
          .select("love_note_id, user_id, reaction_type");

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data: (data as ReactionRow[]) || [] };
      },
      providesTags: ["Reactions"],
    }),

    // ------------------------------------------------------------------
    // publishNote — insert a new LoveNote record.
    // Photo upload (if any) should be done first via uploadNotePhoto;
    // pass the resulting URL as imageUrl.
    // ------------------------------------------------------------------
    publishNote: build.mutation<LoveNote, PublishNoteArgs>({
      queryFn: async (
        { content, loveType, category, imageUrl, loveCoinId, authorName },
        { dispatch },
      ) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data, error } = await supabase
          .from("lovenotes")
          .insert({
            content,
            love_type: loveType,
            category,
            image_url: imageUrl ?? null,
            love_coin_id: loveCoinId ?? null,
            author_name: authorName,
            user_id: user?.id ?? null,
          })
          .select()
          .single();

        if (error) return { error: interceptSupabaseError(error, dispatch) };
        return { data };
      },
      invalidatesTags: ["Notes"],
    }),

    // ------------------------------------------------------------------
    // toggleReaction — add or remove a reaction on a LoveNote.
    // Checks whether the reaction already exists; if it does, deletes it
    // (toggle off); if it doesn't, inserts it (toggle on).
    // ------------------------------------------------------------------
    toggleReaction: build.mutation<void, ToggleReactionArgs>({
      queryFn: async ({ noteId, reactionType, userId }, { dispatch }) => {
        // Check if the reaction already exists
        const { data: existing, error: checkError } = await supabase
          .from("reactions")
          .select("id")
          .eq("love_note_id", noteId)
          .eq("user_id", userId)
          .eq("reaction_type", reactionType)
          .maybeSingle();

        if (checkError) return { error: interceptSupabaseError(checkError, dispatch) };

        if (existing) {
          // Toggle off — delete the existing reaction
          const { error: deleteError } = await supabase
            .from("reactions")
            .delete()
            .eq("id", existing.id);
          if (deleteError) return { error: interceptSupabaseError(deleteError, dispatch) };
        } else {
          // Toggle on — insert a new reaction
          const { error: insertError } = await supabase.from("reactions").insert({
            love_note_id: noteId,
            user_id: userId,
            reaction_type: reactionType,
          });
          if (insertError) return { error: interceptSupabaseError(insertError, dispatch) };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Reactions"],
    }),

    // ------------------------------------------------------------------
    // uploadNotePhoto — upload an image to the note-photos Storage bucket.
    // Returns the public URL on success.
    // ------------------------------------------------------------------
    uploadNotePhoto: build.mutation<string, { file: File; userId: string }>({
      queryFn: async ({ file, userId }, { dispatch }) => {
        const path = generateStoragePath(userId, file.name);

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.notePhotos)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) return { error: interceptSupabaseError(uploadError, dispatch) };

        const {
          data: { publicUrl },
        } = supabase.storage.from(STORAGE_BUCKETS.notePhotos).getPublicUrl(path);

        return { data: publicUrl };
      },
    }),
  }),
});

export const {
  useGetNotesQuery,
  useGetReactionsQuery,
  usePublishNoteMutation,
  useToggleReactionMutation,
  useUploadNotePhotoMutation,
} = fameApi;
