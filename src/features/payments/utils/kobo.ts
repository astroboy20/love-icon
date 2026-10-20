/**
 * Monetary conversion utilities for NGN amounts.
 *
 * All amounts in the database and Bachs API are handled in kobo (the smallest
 * NGN unit: 1 Naira = 100 kobo) to avoid floating-point arithmetic errors.
 * These helpers use only integer arithmetic.
 *
 * Requirements: 4.1, 11.2
 */

/**
 * Convert a Naira amount to kobo using integer arithmetic.
 *
 * @example nairaToKobo(100)    // 10000
 * @example nairaToKobo(1000)   // 100000
 */
export function nairaToKobo(naira: number): number {
  // Math.round guards against any implicit float that sneaks in via JS literals,
  // e.g. nairaToKobo(1.1) → 110 rather than 109.99999...
  return Math.round(naira) * 100;
}

/**
 * Convert a kobo amount to a decimal Naira string suitable for display or for
 * passing to the Bachs API (which expects amounts as decimal strings).
 *
 * @example koboToNairaString(100000)  // "1000.00"
 * @example koboToNairaString(10050)   // "100.50"
 */
export function koboToNairaString(kobo: number): string {
  const naira = Math.trunc(kobo) / 100;
  return naira.toFixed(2);
}

/**
 * Convert a kobo amount to a Naira integer (truncates any fractional kobo).
 *
 * @example koboToNaira(100000) // 1000
 * @example koboToNaira(10050)  // 100
 */
export function koboToNaira(kobo: number): number {
  return Math.trunc(kobo) / 100;
}
