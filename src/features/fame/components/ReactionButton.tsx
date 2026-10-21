/**
 * ReactionButton — a single emoji reaction toggle for a LoveNote.
 *
 * Displays an emoji button with a reaction count. Authenticated users can
 * click to toggle their reaction on or off; unauthenticated users are
 * redirected to /auth.
 *
 * Optimistic updates: on click, the active state and count are updated
 * immediately in local state before the RTK Query mutation resolves.
 * If the mutation fails, the optimistic change is reverted so the UI
 * stays consistent with the server.
 *
 * Data source: `fameApi.getReactions` provides all reactions; count and
 * active status for this specific note/type are derived from that cache.
 *
 * Requirements: 22.7, 22.11
 */
import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGetReactionsQuery, useToggleReactionMutation } from "@/features/fame/api/fameApi";
import { useAppSelector } from "@/app/store";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import type { ReactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReactionButtonProps {
  noteId: string;
  reactionType: ReactionType;
  emoji: string;
  label: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReactionButton renders a single emoji reaction toggle button for a LoveNote.
 *
 * It reads the current reaction state from the `fameApi.getReactions` cache and
 * applies an optimistic local update on click so the UI feels instant. The
 * optimistic change is reverted if the mutation fails.
 *
 * Unauthenticated users are redirected to /auth when they click a reaction.
 */
export function ReactionButton({
  noteId,
  reactionType,
  emoji,
  label,
  className,
}: ReactionButtonProps) {
  const navigate = useNavigate();
  const currentUser = useAppSelector(selectCurrentUser);

  // ---- Server state ----
  const { data: reactions = [] } = useGetReactionsQuery();
  const [toggleReaction, { isLoading }] = useToggleReactionMutation();

  // Derive server-side count and active status
  const serverCount = reactions.filter(
    (r) => r.love_note_id === noteId && r.reaction_type === reactionType,
  ).length;

  const serverIsActive = currentUser
    ? reactions.some(
        (r) =>
          r.love_note_id === noteId &&
          r.reaction_type === reactionType &&
          r.user_id === currentUser.id,
      )
    : false;

  // ---- Optimistic local state ----
  // null means "use server state" (no pending optimistic update)
  const [optimisticActive, setOptimisticActive] = React.useState<boolean | null>(null);
  const [optimisticDelta, setOptimisticDelta] = React.useState<number>(0);

  // ---- Pop animation ----
  const [isPopped, setIsPopped] = React.useState(false);

  // Merge server and optimistic state
  const isActive = optimisticActive !== null ? optimisticActive : serverIsActive;
  const count = serverCount + optimisticDelta;

  // ---------------------------------------------------------------------------
  // Handler
  // ---------------------------------------------------------------------------

  const handleClick = async () => {
    if (!currentUser) {
      await navigate({ to: "/auth" });
      return;
    }

    // Prevent double-click while loading
    if (isLoading) return;

    // Apply optimistic update immediately
    const willBeActive = !isActive;
    const delta = willBeActive ? 1 : -1;
    setOptimisticActive(willBeActive);
    setOptimisticDelta((prev) => prev + delta);

    // Trigger pop animation
    setIsPopped(true);
    setTimeout(() => setIsPopped(false), 450);

    const result = await toggleReaction({
      noteId,
      reactionType,
      userId: currentUser.id,
    });

    if ("error" in result) {
      // Revert optimistic update on failure
      setOptimisticActive(null);
      setOptimisticDelta((prev) => prev - delta);
    } else {
      // Server confirmed — clear optimistic state so server data drives the UI
      setOptimisticActive(null);
      setOptimisticDelta(0);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      aria-label={`React with ${label}${count > 0 ? `: ${count}` : ""}`}
      aria-pressed={isActive}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isActive
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 text-muted-foreground hover:border-primary/30",
        className,
      )}
    >
      <span className={isPopped ? "animate-react-pop" : ""}>{emoji}</span>
      {count > 0 && <span className="text-xs font-semibold">{count}</span>}
    </button>
  );
}
