/**
 * PaymentConfirming — "confirming your payment" state after Bachs redirect.
 *
 * Displayed when the user returns from the Bachs hosted checkout page.
 * Polls `paymentsApi.getOrderStatus` every 3 seconds until the purchase order
 * transitions to a terminal state:
 *
 *   - "succeeded"  → calls `onSuccess` with the first claimed coin number
 *   - "failed"     → calls `onFailed` with an error message
 *   - "cancelled"  → reached via the cancel button; calls `onCancelled`
 *
 * The component also exposes a cancel button that:
 *   1. Calls `paymentsApi.cancelPurchaseOrder` (RLS-enforced; only permitted
 *      when the order is still "pending")
 *   2. Calls `onCancelled` so the parent can clean up state
 *
 * This component intentionally does **not** insert LoveCoin records. Coin
 * insertion occurs exclusively inside the Bachs webhook Edge Function after
 * verified payment (Requirement 13.5, 4.5).
 *
 * Requirements: 4.4, 4.5, 4.6, 12.6, 18.2
 */
import * as React from "react";
import {
  useGetOrderStatusQuery,
  useCancelPurchaseOrderMutation,
  type PurchaseOrder,
} from "@/features/payments/api/paymentsApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentConfirmingProps {
  /**
   * UUID of the `purchase_order` row to poll.
   * Comes from the `orderId` query param after Bachs redirects back.
   */
  orderId: string;

  /**
   * Coin numbers associated with this order — used to navigate to the first
   * coin's detail page on success.  Falls back to `order.coin_numbers[0]` when
   * not provided.
   */
  coinNumbers?: number[];

  /**
   * Called when the order reaches "succeeded" status.
   * Receives the first coin number so the caller can navigate to the coin
   * detail page.
   */
  onSuccess: (firstCoinNumber: number) => void;

  /**
   * Called when the order reaches "failed" status.
   * The component passes a human-readable reason string.
   */
  onFailed: (reason: string) => void;

  /**
   * Called after the user has successfully cancelled the pending order.
   */
  onCancelled: () => void;

  /** Additional CSS class names forwarded to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Internal: cancel confirmation dialog
// ---------------------------------------------------------------------------

interface CancelConfirmProps {
  onConfirm: () => void;
  onBack: () => void;
  isCancelling: boolean;
}

function CancelConfirmPanel({ onConfirm, onBack, isCancelling }: CancelConfirmProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center" role="alertdialog" aria-labelledby="cancel-confirm-title">
      <span className="text-4xl" aria-hidden>⚠️</span>
      <div>
        <h3 id="cancel-confirm-title" className="font-display text-xl text-foreground">
          Cancel this payment?
        </h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Your selected spots will be released and no coins will be claimed. You can start a new
          checkout whenever you&apos;re ready.
        </p>
      </div>
      <div className="flex w-full gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={isCancelling}
        >
          Go back
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={onConfirm}
          disabled={isCancelling}
          aria-busy={isCancelling}
        >
          {isCancelling ? "Cancelling…" : "Yes, cancel"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: cancelled state panel
// ---------------------------------------------------------------------------

interface CancelledPanelProps {
  onDismiss: () => void;
}

function CancelledPanel({ onDismiss }: CancelledPanelProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <span className="text-4xl" aria-hidden>💔</span>
      <div>
        <h3 className="font-display text-xl text-foreground">Payment cancelled</h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Your order has been cancelled and no coins were claimed. Your selected spots are now
          available again.
        </p>
      </div>
      <Button type="button" className="w-full" onClick={onDismiss}>
        Back to the heart
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: failed state panel
// ---------------------------------------------------------------------------

interface FailedPanelProps {
  reason: string;
  onDismiss: () => void;
}

function FailedPanel({ reason, onDismiss }: FailedPanelProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <span className="text-4xl" aria-hidden>❌</span>
      <div>
        <h3 className="font-display text-xl text-destructive">Payment didn&apos;t go through</h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{reason}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No coins were claimed. You can try again from the explore page.
        </p>
      </div>
      <Button type="button" className="w-full" onClick={onDismiss}>
        Try again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaymentConfirming — main component
// ---------------------------------------------------------------------------

type InternalPhase =
  | "polling"          // actively waiting for webhook to settle the order
  | "confirm-cancel"   // user clicked cancel; asking for confirmation
  | "cancelling"       // cancel mutation in flight
  | "cancelled"        // order was successfully cancelled
  | "failed";          // order reached "failed" terminal state

/**
 * PaymentConfirming renders the post-Bachs-redirect "confirming" screen.
 *
 * ```
 * ┌────────────────────────────────────┐
 * │  ◌  Confirming your payment…       │
 * │     Please wait while we verify…   │
 * │                                    │
 * │         [Cancel payment]           │
 * └────────────────────────────────────┘
 * ```
 *
 * Transitions:
 *   - order.status === "succeeded"  → calls `onSuccess(firstCoinNumber)`
 *   - order.status === "failed"     → shows error panel, then calls `onFailed`
 *   - User clicks cancel (pending)  → shows confirmation, then calls `onCancelled`
 *
 * @example
 * <PaymentConfirming
 *   orderId={orderId}
 *   coinNumbers={pendingCoinNumbers}
 *   onSuccess={(n) => navigate({ to: '/coin/$coinNumber', params: { coinNumber: String(n) } })}
 *   onFailed={(msg) => setError(msg)}
 *   onCancelled={() => setShowConfirming(false)}
 * />
 */
export function PaymentConfirming({
  orderId,
  coinNumbers = [],
  onSuccess,
  onFailed,
  onCancelled,
  className,
}: PaymentConfirmingProps): React.ReactElement {
  const [phase, setPhase] = React.useState<InternalPhase>("polling");
  const [failReason, setFailReason] = React.useState<string>(
    "Your payment didn't go through. No coins were claimed.",
  );

  // ---- RTK Query: poll order status every 3 seconds ----
  const {
    data: order,
    error: pollError,
  } = useGetOrderStatusQuery(orderId, {
    pollingInterval: phase === "polling" ? 3000 : 0,
    skip: !orderId || phase !== "polling",
  });

  // ---- RTK Mutation: cancel order ----
  const [cancelOrder, { isLoading: isCancelling }] = useCancelPurchaseOrderMutation();

  // ---- React to order status changes ----
  React.useEffect(() => {
    if (phase !== "polling" || !order) return;

    if (order.status === "succeeded") {
      const firstCoin = resolveFirstCoin(order, coinNumbers);
      if (firstCoin !== undefined) {
        onSuccess(firstCoin);
      }
    } else if (order.status === "failed") {
      setFailReason("Your payment didn't go through. No coins were claimed.");
      setPhase("failed");
    } else if (order.status === "cancelled") {
      // Order was cancelled externally (e.g., from another tab); surface it.
      setPhase("cancelled");
    }
  }, [order, phase, coinNumbers, onSuccess]);

  // Treat a polling query error as a payment failure.
  React.useEffect(() => {
    if (phase !== "polling" || !pollError) return;
    setFailReason(
      "We couldn't verify your payment status. Please check your LoveCoins page or contact support.",
    );
    setPhase("failed");
  }, [pollError, phase]);

  // Propagate "failed" phase to the parent after the user dismisses the panel.
  const handleFailedDismiss = React.useCallback(() => {
    onFailed(failReason);
  }, [onFailed, failReason]);

  // ---- Cancel flow ----

  const handleCancelClick = () => setPhase("confirm-cancel");
  const handleCancelBack = () => setPhase("polling");

  const handleCancelConfirm = async () => {
    setPhase("cancelling");
    try {
      const result = await cancelOrder(orderId);
      if ("error" in result) {
        // If RLS rejected the cancel (order is no longer pending), treat as failure.
        setFailReason(
          "This order could not be cancelled — it may have already been processed. " +
            "Check your LoveCoins page to see if any coins were claimed.",
        );
        setPhase("failed");
      } else {
        setPhase("cancelled");
      }
    } catch {
      setFailReason("Cancellation failed. Please try again.");
      setPhase("failed");
    }
  };

  const handleCancelledDismiss = () => {
    onCancelled();
  };

  // ---- Render by phase ----

  return (
    <div className={cn("flex flex-col", className)}>
      {/* ── Polling: spinner + cancel option ──────────────────────── */}
      {(phase === "polling" || phase === "confirm-cancel") && (
        <>
          {phase === "polling" && (
            <PollingPanel onCancelClick={handleCancelClick} order={order} />
          )}
          {phase === "confirm-cancel" && (
            <CancelConfirmPanel
              onConfirm={handleCancelConfirm}
              onBack={handleCancelBack}
              isCancelling={false}
            />
          )}
        </>
      )}

      {/* ── Cancelling: spinner while mutation is in flight ───────── */}
      {phase === "cancelling" && (
        <CancelConfirmPanel
          onConfirm={handleCancelConfirm}
          onBack={handleCancelBack}
          isCancelling={isCancelling}
        />
      )}

      {/* ── Cancelled ─────────────────────────────────────────────── */}
      {phase === "cancelled" && (
        <CancelledPanel onDismiss={handleCancelledDismiss} />
      )}

      {/* ── Failed ────────────────────────────────────────────────── */}
      {phase === "failed" && (
        <FailedPanel reason={failReason} onDismiss={handleFailedDismiss} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: polling panel
// ---------------------------------------------------------------------------

interface PollingPanelProps {
  onCancelClick: () => void;
  /** Live order data from the poll — used to show extra context once available. */
  order: PurchaseOrder | null | undefined;
}

function PollingPanel({ onCancelClick, order }: PollingPanelProps) {
  // Only show the cancel button while the order is still pending.
  const canCancel = !order || order.status === "pending";

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      {/* Animated spinner */}
      <div
        className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
        role="status"
        aria-label="Confirming payment"
      />

      <div>
        <h2 className="font-display text-2xl text-primary">Confirming your payment…</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Please wait while we verify your payment. This usually takes just a moment.
        </p>
      </div>

      {/* Progress indicator: show once we know the order is still pending */}
      {order && order.status === "pending" && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Waiting for payment confirmation from Bachs…
        </p>
      )}

      {/* Cancel — only available while order is pending */}
      {canCancel && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancelClick}
          className="mt-2 text-muted-foreground hover:text-destructive"
        >
          Cancel payment
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the first coin number to navigate to after a successful payment.
 * Prefers the caller-supplied `coinNumbers` array (which may have been
 * persisted to localStorage before the Bachs redirect) and falls back to
 * `order.coin_numbers` from the database.
 */
function resolveFirstCoin(
  order: PurchaseOrder,
  callerCoinNumbers: number[],
): number | undefined {
  if (callerCoinNumbers.length > 0) return callerCoinNumbers[0];
  if (order.coin_numbers && order.coin_numbers.length > 0) return order.coin_numbers[0];
  return undefined;
}
