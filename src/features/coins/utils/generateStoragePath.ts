/**
 * Storage path generation for Supabase Storage uploads.
 *
 * Paths follow the format `{userId}/{timestamp}-{randomId}.{ext}`, where:
 * - `userId`    is `auth.uid()` — the first path segment, required for RLS
 *               enforcement on the `coin-photos` and `note-photos` buckets
 * - `timestamp` is `Date.now()` in milliseconds — prevents collisions across time
 * - `randomId`  is a short random alphanumeric string — adds entropy within the
 *               same millisecond
 * - `ext`       is the lowercase file extension extracted from the filename
 *
 * The storage RLS policy checks `storage.foldername(name)[1] = auth.uid()`,
 * so the userId prefix is load-bearing for security — authenticated users may
 * only write to their own folder.
 *
 * Requirements: 2.5, 3.5, 19.1, 19.2
 */

/**
 * Length of the random suffix appended to each storage path for entropy.
 * Six base-36 characters give ~2.2 billion combinations, sufficient to prevent
 * collisions within the same millisecond.
 */
const RANDOM_ID_LENGTH = 6;

/**
 * Generate a unique, user-scoped storage path for an uploaded file.
 *
 * The resulting path is safe to use as the object key for both the
 * `coin-photos` and `note-photos` Supabase Storage buckets.
 *
 * @param userId   - The authenticated user's ID (`auth.uid()`). Used as the
 *                   first path segment so that RLS policies can enforce per-user
 *                   write access via `storage.foldername(name)[1] = auth.uid()`.
 * @param filename - The original filename supplied by the client. Only the
 *                   extension is preserved; the original name is discarded to
 *                   avoid leaking user data and to normalise casing.
 *
 * @returns A storage path string in the format
 *          `{userId}/{timestamp}-{randomId}.{ext}`
 *
 * @example
 * generateStoragePath(
 *   "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "profile-photo.jpg"
 * )
 * // "a1b2c3d4-e5f6-7890-abcd-ef1234567890/1719876543210-abc123.jpg"
 */
export function generateStoragePath(userId: string, filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const ext = dotIndex !== -1 ? filename.slice(dotIndex + 1).toLowerCase() : "";

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 2 + RANDOM_ID_LENGTH);

  const namePart = ext ? `${timestamp}-${randomId}.${ext}` : `${timestamp}-${randomId}`;

  return `${userId}/${namePart}`;
}
