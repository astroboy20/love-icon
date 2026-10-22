/**
 * ProfileEditor — form for editing the authenticated user's display name.
 *
 * Reads the current user from the Redux auth slice and pre-populates the
 * display name input. On submit, calls `authApi.updateDisplayName` and on
 * success dispatches `setCurrentUser` to update the auth slice in-place so
 * the new name is visible immediately across the app without a page reload.
 *
 * Shows an inline error alert on mutation failure and an inline success
 * message on confirmation. Returns null when no user is signed in.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
import * as React from "react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { selectCurrentUser, setCurrentUser } from "@/features/auth/slices/authSlice";
import { useUpdateDisplayNameMutation } from "@/features/auth/api/authApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ProfileEditor
// ---------------------------------------------------------------------------

/**
 * Renders a profile editing form for the currently authenticated user.
 *
 * The display name input is pre-populated with the user's current name.
 * Submitting the form calls `updateDisplayName` and, on success, updates the
 * Redux auth slice immediately (Requirement 6.3) so the change is visible
 * everywhere without a page reload.
 *
 * Returns null when `currentUser` is null (Requirement 6.1 — only shown for
 * authenticated users).
 */
export function ProfileEditor({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  const [updateDisplayName, { isLoading }] = useUpdateDisplayNameMutation();

  // Local form state
  const [displayName, setDisplayName] = React.useState(currentUser?.displayName ?? "");

  // Keep input in sync if currentUser changes externally (e.g., session restore)
  React.useEffect(() => {
    if (currentUser?.displayName) {
      setDisplayName(currentUser.displayName);
    }
  }, [currentUser?.displayName]);

  // Guard: do not render if no user is authenticated (Requirement 6.1)
  if (!currentUser) return null;

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = displayName.trim();

    if (!trimmed) {
      toast.error("Display name cannot be empty.");
      return;
    }

    const result = await updateDisplayName({
      userId: currentUser.id,
      displayName: trimmed,
    });

    if ("error" in result) {
      const err = result.error as { message?: string } | undefined;
      toast.error(err?.message ?? "Failed to update display name. Please try again.");
      return;
    }

    // Requirement 6.3 — update authSlice immediately, no page reload
    dispatch(
      setCurrentUser({
        ...currentUser,
        displayName: trimmed,
      }),
    );

    toast.success("Display name updated successfully.");
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} noValidate aria-label="Edit profile">
          <div className="space-y-4">
            {/* Display name field — Requirement 6.2 */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input
                id="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                placeholder="Your display name"
                autoComplete="nickname"
                maxLength={100}
              />
            </div>

            {/* Save button — disabled + loading state while in-flight */}
            <Button
              type="submit"
              disabled={isLoading || displayName.trim() === ""}
              aria-busy={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
