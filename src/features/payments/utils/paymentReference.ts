/**
 * Payment reference generation for LoveCoin purchase orders.
 *
 * Each checkout attempt gets a unique payment reference that serves as both the
 * Bachs idempotency key and the unique constraint in the `purchase_orders` table.
 * This ensures that retried checkout session creations or webhook deliveries
 * do not result in duplicate charges or coin claims.
 *
 * Requirements: 4.8, 12.8, 13.1
 */

/**
 * Generate a unique payment reference for a purchase order.
 *
 * The reference is used as:
 * - The `payment_reference` field in the `purchase_orders` table (unique constraint)
 * - The `Idempotency-Key` header for the Bachs checkout session creation
 * - The `reference` field in the Bachs checkout session metadata
 *
 * @param userId - The authenticated user's ID (from auth.uid())
 * @param timestamp - A timestamp (typically Date.now()) for uniqueness
 *
 * @returns A payment reference string in the format `lovecoin-{userId}-{timestamp}`
 *
 * @example
 * generatePaymentReference("a1b2c3d4-e5f6-7890-abcd-ef1234567890", 1719876543210)
 * // "lovecoin-a1b2c3d4-e5f6-7890-abcd-ef1234567890-1719876543210"
 */
export function generatePaymentReference(userId: string, timestamp: number): string {
  return `lovecoin-${userId}-${timestamp}`;
}
