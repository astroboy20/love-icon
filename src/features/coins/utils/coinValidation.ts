/**
 * Coin purchase validation utilities.
 *
 * These helpers enforce the minimum purchase size rule, calculate the total
 * payment amount in kobo, and detect Postgres unique-constraint violations
 * on the `coin_number` column so the UI can prompt the user to pick a
 * different spot.
 *
 * Requirements: 10.1, 10.5, 11.2, 11.3, 11.4
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of spots that must be selected to complete a purchase. */
export const MIN_SPOTS = 10;

/**
 * Price of a single LoveCoin spot in kobo (₦100 = 10 000 kobo).
 *
 * All monetary values are stored and transmitted in kobo to avoid
 * floating-point arithmetic errors.
 */
export const COIN_PRICE_KOBO = 10_000;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Return `true` when the spot count meets the minimum purchase requirement.
 *
 * @param count - Number of spots the user has selected.
 *
 * @example validateMinSpots(10)  // true
 * @example validateMinSpots(9)   // false
 * @example validateMinSpots(50)  // true
 */
export function validateMinSpots(count: number): boolean {
  return count >= MIN_SPOTS;
}

/**
 * Calculate the total payment amount in kobo for a given number of spots.
 *
 * @param spotCount - Number of spots being purchased.
 * @returns Total amount in kobo (integer arithmetic, no floating point).
 *
 * @example calculateTotalKobo(10)  // 100000
 * @example calculateTotalKobo(25)  // 250000
 */
export function calculateTotalKobo(spotCount: number): number {
  return spotCount * COIN_PRICE_KOBO;
}

// ---------------------------------------------------------------------------
// Error detection
// ---------------------------------------------------------------------------

/**
 * Narrow an unknown error to a Postgres unique-constraint violation on the
 * `coin_number` column (error code `'23505'`).
 *
 * Supabase surfaces PostgREST / libpq errors as plain objects that carry a
 * `code` field. A `'23505'` code means `unique_violation`, which happens when
 * two buyers race to claim the same coin number. Detecting this lets the UI
 * display a "pick another spot" message instead of a generic error.
 *
 * @param error - The value caught from a Supabase query or any unknown throw.
 * @returns `true` if the error is a unique-violation on `coin_number`.
 *
 * @example
 * const { error } = await supabase.from("lovecoins").insert({ coin_number: 42, ... });
 * if (isCoinNumberConflictError(error)) {
 *   // prompt user to choose a different spot
 * }
 */
export function isCoinNumberConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const e = error as Record<string, unknown>;

  // Postgres error code 23505 = unique_violation
  if (e["code"] !== "23505") return false;

  // Confirm the violation targets the coin_number column or constraint.
  // Supabase exposes the constraint name in `details` or the column name in
  // `message` — check both to be resilient across PostgREST versions.
  const details = typeof e["details"] === "string" ? e["details"] : "";
  const message = typeof e["message"] === "string" ? e["message"] : "";
  const constraint = typeof e["constraint"] === "string" ? e["constraint"] : "";

  return (
    details.includes("coin_number") ||
    message.includes("coin_number") ||
    constraint.includes("coin_number")
  );
}
