/**
 * PaymentSummary — displays the spot count and total purchase amount.
 *
 * Shows a clear breakdown of `spotCount × ₦100` so the user knows exactly
 * what they are paying before proceeding to checkout.  Optionally surfaces a
 * minimum-spots warning when the selection is below the required threshold.
 *
 * Requirements: 11.4
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  calculateTotalKobo,
  MIN_SPOTS,
  COIN_PRICE_KOBO,
} from "@/features/coins/utils/coinValidation";
import { koboToNairaString } from "@/features/payments/utils/kobo";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaymentSummaryProps {
  /** Number of coin spots currently selected. */
  spotCount: number;
  /**
   * When `true` the component renders a warning row indicating the minimum
   * purchase size hasn't been met yet.  Defaults to `true`.
   */
  showMinWarning?: boolean;
  /** Additional CSS class names forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRICE_PER_SPOT_NAIRA = COIN_PRICE_KOBO / 100; // ₦100

function formatNaira(kobo: number): string {
  // Drop the ".00" suffix for whole-naira amounts to keep the UI clean.
  return `₦${koboToNairaString(kobo).replace(/\.00$/, "")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PaymentSummary renders an at-a-glance price breakdown:
 *
 * ```
 * ┌─────────────────────────────────────────┐
 * │  10 spots × ₦100 each        ₦1,000     │
 * │  ⚠ Select at least 10 spots             │  ← optional warning
 * └─────────────────────────────────────────┘
 * ```
 *
 * @example
 * <PaymentSummary spotCount={selectedCount} />
 */
export function PaymentSummary({
  spotCount,
  showMinWarning = true,
  className,
}: PaymentSummaryProps): React.ReactElement {
  const totalKobo = calculateTotalKobo(spotCount);
  const totalDisplay = formatNaira(totalKobo);
  const minNotMet = showMinWarning && spotCount < MIN_SPOTS;
  const spotsLabel = spotCount === 1 ? "spot" : "spots";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden",
        className,
      )}
      aria-label="Payment summary"
    >
      {/* Main row: spot count × price per spot → total */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {spotCount} {spotsLabel} &times; ₦{PRICE_PER_SPOT_NAIRA} each
        </span>
        <span
          className="font-display text-xl font-semibold text-primary"
          aria-label={`Total: ${totalDisplay}`}
        >
          {totalDisplay}
        </span>
      </div>

      {/* Minimum-spots warning */}
      {minNotMet && (
        <div
          role="alert"
          className="border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Select at least {MIN_SPOTS} spots to check out — minimum purchase is{" "}
            ₦{(MIN_SPOTS * PRICE_PER_SPOT_NAIRA).toLocaleString()}.
          </p>
        </div>
      )}
    </div>
  );
}
