/**
 * ClaimFlow — multi-spot coin claim modal.
 *
 * Guides the user through three steps:
 *   1. Personalizing  — per-spot form (name, message, photo, style) + total display
 *   2. Paying         — redirects to Bachs hosted checkout
 *   3. Confirming     — polls purchase order status after Bachs redirect
 *
 * Reads selected coin numbers and modal open state from `coinsSlice`.
 * Dispatches `closeClaimFlow` / `clearSelection` on completion or close.
 *
 * Requirements: 2.1, 2.2, 2.3, 4.3, 4.4, 4.5, 4.6, 4.8,
 *               10.1, 10.2, 10.3, 10.4, 10.5,
 *               11.1, 11.2, 11.3, 11.4, 11.5, 11.6,
 *               22.7, 22.11
 */
import * as React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Modal } from "@/components/Modal";
import {
  CoinPersonalizationForm,
  BulkApplyBar,
  makeDefaultSpot,
  type SpotPersonalization,
  type BulkApplyFields,
} from "@/features/coins/components/CoinPersonalizationForm";
import { useAppSelector, useAppDispatch } from "@/app/store";
import {
  selectSelectedCoinNumbers,
  selectIsClaimFlowOpen,
  closeClaimFlow,
  clearSelection,
} from "@/features/coins/slices/coinsSlice";
import { selectCurrentUser } from "@/features/auth/slices/authSlice";
import {
  useCreatePurchaseOrderMutation,
  useCreateBachsCheckoutMutation,
  useGetOrderStatusQuery,
} from "@/features/payments/api/paymentsApi";
import {
  MIN_SPOTS,
  COIN_PRICE_KOBO,
  calculateTotalKobo,
  isCoinNumberConflictError,
} from "@/features/coins/utils/coinValidation";
import { generatePaymentReference } from "@/features/payments/utils/paymentReference";
import { koboToNairaString } from "@/features/payments/utils/kobo";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowStep = "personalizing" | "paying" | "confirming";

// ---------------------------------------------------------------------------
// ConfirmingState — displayed while polling order status after Bachs redirect
// ---------------------------------------------------------------------------

interface ConfirmingStateProps {
  orderId: string;
  onSuccess: (firstCoinNumber: number) => void;
  onFailed: () => void;
  coinNumbers: number[];
}

function ConfirmingState({ orderId, onSuccess, onFailed, coinNumbers }: ConfirmingStateProps) {
  // Poll every 3 seconds until the order settles.
  const { data: order, error } = useGetOrderStatusQuery(orderId, {
    pollingInterval: 3000,
    skip: !orderId,
  });

  React.useEffect(() => {
    if (!order) return;
    if (order.status === "succeeded") {
      const first = coinNumbers[0] ?? order.coin_numbers?.[0];
      if (first !== undefined) onSuccess(first);
    } else if (order.status === "failed") {
      onFailed();
    }
  }, [order, coinNumbers, onSuccess, onFailed]);

  React.useEffect(() => {
    if (error) onFailed();
  }, [error, onFailed]);

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      {/* Spinner */}
      <div
        className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
        role="status"
        aria-label="Confirming payment"
      />
      <div>
        <h2 className="font-display text-2xl text-primary">Confirming your payment…</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we verify your payment. This usually takes just a moment.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClaimFlow — main modal component
// ---------------------------------------------------------------------------

/**
 * ClaimFlow modal drives the full claim flow for multi-spot coin purchases.
 *
 * It reads state from the Redux store (`coinsSlice`) and dispatches actions
 * to close the modal and clear the selection on completion.
 *
 * The `orderId` query param is read to detect the post-Bachs redirect state
 * so the component can jump directly to the "confirming" step when the user
 * returns from the Bachs hosted checkout.
 */
export function ClaimFlow() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // ---- Redux state ----
  const isOpen = useAppSelector(selectIsClaimFlowOpen);
  const selectedCoinNumbers = useAppSelector(selectSelectedCoinNumbers);
  const currentUser = useAppSelector(selectCurrentUser);

  // ---- RTK mutations ----
  const [createPurchaseOrder] = useCreatePurchaseOrderMutation();
  const [createBachsCheckout] = useCreateBachsCheckoutMutation();
  // uploadCoinPhoto is used inside CoinPhotoUploader, but we need it here too
  // for uploading photos that haven't gone through the uploader yet.
  // We don't use it directly here because CoinPhotoUploader handles its own upload.

  // ---- Local UI state ----
  const [step, setStep] = React.useState<FlowStep>("personalizing");
  const [spots, setSpots] = React.useState<SpotPersonalization[]>([]);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [conflictError, setConflictError] = React.useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = React.useState<string | null>(null);
  const [confirmingCoinNumbers, setConfirmingCoinNumbers] = React.useState<number[]>([]);

  // ---- Post-Bachs redirect: check for ?orderId in URL ----
  // We wrap in try/catch because the route may not expose this search param.
  let searchOrderId: string | null = null;
  try {
    // TanStack Router's useSearch returns the current route's search params.
    // We cast to `any` because the shape varies by route and this component
    // may be rendered on routes that don't declare `orderId` as a param.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const search = useSearch({ strict: false }) as any;
    searchOrderId = typeof search?.orderId === "string" ? search.orderId : null;
  } catch {
    searchOrderId = null;
  }

  // When the user returns from Bachs redirect, open the confirming step.
  React.useEffect(() => {
    if (searchOrderId && step !== "confirming") {
      setConfirmingOrderId(searchOrderId);
      // Restore coin numbers from localStorage if available (set before redirect).
      const stored = localStorage.getItem("lovecoin_pending_coin_numbers");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as number[];
          setConfirmingCoinNumbers(parsed);
        } catch {
          // ignore parse errors
        }
      }
      setStep("confirming");
      // Open the modal so the confirming state is visible.
      // (The modal is controlled by isOpen from the Redux store;
      // if it's not open we still show confirming via the inline render below)
    }
  }, [searchOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync spot list when selectedCoinNumbers changes (e.g. user adds/removes spots before opening).
  React.useEffect(() => {
    setSpots((prev) => {
      const prevMap = new Map(prev.map((s) => [s.coinNumber, s]));
      return selectedCoinNumbers.map(
        (n) => prevMap.get(n) ?? makeDefaultSpot(n),
      );
    });
  }, [selectedCoinNumbers]);

  // Reset local state whenever the modal opens fresh.
  React.useEffect(() => {
    if (isOpen && step !== "confirming") {
      setStep("personalizing");
      setErrorMessage(null);
      setConflictError(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Helpers ----

  const spotCount = spots.length;
  const totalKobo = calculateTotalKobo(spotCount);
  const totalNairaDisplay = `₦${koboToNairaString(totalKobo).replace(/\.00$/, "")}`;
  const canCheckout = spotCount >= MIN_SPOTS && spots.every((s) => s.creatorName.trim() && s.recipientName.trim());

  const close = React.useCallback(() => {
    dispatch(closeClaimFlow());
    setStep("personalizing");
    setErrorMessage(null);
    setConflictError(false);
    setExpandedIndex(0);
  }, [dispatch]);

  const updateSpot = React.useCallback((coinNumber: number, updated: SpotPersonalization) => {
    setSpots((prev) => prev.map((s) => (s.coinNumber === coinNumber ? updated : s)));
  }, []);

  const applyToAll = React.useCallback(
    (fields: BulkApplyFields) => {
      setSpots((prev) =>
        prev.map((s) => ({
          ...s,
          ...(fields.creatorName ? { creatorName: fields.creatorName } : {}),
          ...(fields.recipientName ? { recipientName: fields.recipientName } : {}),
          style: fields.style,
        })),
      );
    },
    [],
  );

  // ---- Checkout handler ----

  const handleCheckout = async () => {
    if (!currentUser) return;
    if (spotCount < MIN_SPOTS) {
      setErrorMessage(`Please select at least ${MIN_SPOTS} spots to proceed.`);
      return;
    }
    if (!canCheckout) {
      setErrorMessage("Please add a name for each spot before checking out.");
      return;
    }

    setErrorMessage(null);
    setConflictError(false);
    setStep("paying");

    try {
      const coinNumbers = spots.map((s) => s.coinNumber);
      const paymentReference = generatePaymentReference(currentUser.id, Date.now());

      // Step 1: Create the pending purchase order.
      const orderResult = await createPurchaseOrder({
        coinNumbers,
        totalAmountKobo: totalKobo,
        paymentReference,
      });

      if ("error" in orderResult) {
        const err = orderResult.error;
        if (isCoinNumberConflictError(err)) {
          setConflictError(true);
        } else {
          setErrorMessage(
            typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : "Failed to create your order. Please try again.",
          );
        }
        setStep("personalizing");
        return;
      }

      const orderId = orderResult.data.id;

      // Step 2: Create the Bachs hosted checkout session.
      const checkoutResult = await createBachsCheckout({
        orderId,
        paymentReference,
        totalAmountKobo: totalKobo,
        coinNumbers,
      });

      if ("error" in checkoutResult) {
        setErrorMessage(
          typeof checkoutResult.error === "object" &&
            checkoutResult.error !== null &&
            "message" in checkoutResult.error
            ? String((checkoutResult.error as { message: unknown }).message)
            : "Failed to initiate checkout. Please try again.",
        );
        setStep("personalizing");
        return;
      }

      // Persist coin numbers to localStorage before redirect so we can restore
      // them when the user returns from Bachs.
      localStorage.setItem("lovecoin_pending_coin_numbers", JSON.stringify(coinNumbers));

      // Step 3: Redirect to Bachs hosted checkout.
      window.location.href = checkoutResult.data.checkoutUrl;
    } catch (err) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setStep("personalizing");
    }
  };

  // ---- Post-payment callbacks ----

  const handlePaymentSuccess = React.useCallback(
    (firstCoinNumber: number) => {
      localStorage.removeItem("lovecoin_pending_coin_numbers");
      dispatch(clearSelection());
      dispatch(closeClaimFlow());
      navigate({ to: "/coin/$coinNumber", params: { coinNumber: String(firstCoinNumber) } });
    },
    [dispatch, navigate],
  );

  const handlePaymentFailed = React.useCallback(() => {
    setErrorMessage("Payment failed. Please try again or contact support.");
    setStep("personalizing");
    setConfirmingOrderId(null);
    localStorage.removeItem("lovecoin_pending_coin_numbers");
  }, []);

  // ---- Render: confirming state (may render outside of isOpen when post-redirect) ----

  if (step === "confirming" && confirmingOrderId) {
    return (
      <Modal open={true} onClose={close} labelledBy="confirming-title">
        <ConfirmingState
          orderId={confirmingOrderId}
          coinNumbers={confirmingCoinNumbers}
          onSuccess={handlePaymentSuccess}
          onFailed={handlePaymentFailed}
        />
      </Modal>
    );
  }

  // ---- Render: not signed in ----

  if (isOpen && !currentUser) {
    return (
      <Modal open={isOpen} onClose={close} labelledBy="signin-title">
        <div className="py-4 text-center">
          <h2 id="signin-title" className="font-display text-3xl text-primary">
            Sign in to keep this one.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Your LoveCoins are saved to your account so they&apos;re waiting on any device.
          </p>
          <Button
            className="mt-7 w-full"
            onClick={() => {
              close();
              navigate({ to: "/auth" });
            }}
          >
            Sign in or create an account
          </Button>
        </div>
      </Modal>
    );
  }

  if (!isOpen) return null;

  // ---- Render: paying state ----

  if (step === "paying") {
    return (
      <Modal open={isOpen} onClose={close} labelledBy="paying-title">
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <div
            className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"
            role="status"
            aria-label="Preparing checkout"
          />
          <div>
            <h2 id="paying-title" className="font-display text-2xl text-primary">
              Preparing your checkout…
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Securing your {spotCount} {spotCount === 1 ? "spot" : "spots"}.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- Render: personalizing step ----

  return (
    <Modal open={isOpen} onClose={close} labelledBy="claim-title">
      {/* Header */}
      <div className="text-center">
        <h2 id="claim-title" className="font-display text-3xl text-primary">
          Claim your pieces of love.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {spotCount} {spotCount === 1 ? "spot" : "spots"} selected · {totalNairaDisplay}
        </p>
        {spotCount < MIN_SPOTS && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Select at least {MIN_SPOTS} spots to check out (you have {spotCount}).
          </p>
        )}
      </div>

      {/* Spot list */}
      <div className="mt-6 space-y-3">
        {spots.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No spots selected. Close this modal and tap spots on the heart.
          </p>
        ) : (
          <>
            {/* Bulk apply */}
            {spots.length > 1 && (
              <BulkApplyBar onApply={applyToAll} />
            )}

            {/* Per-spot forms */}
            {spots.map((spot, idx) => (
              <CoinPersonalizationForm
                key={spot.coinNumber}
                spot={spot}
                onChange={(updated) => updateSpot(spot.coinNumber, updated)}
                isExpanded={expandedIndex === idx}
                onToggle={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
              />
            ))}
          </>
        )}
      </div>

      {/* Total + checkout button */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium">
            {spotCount} {spotCount === 1 ? "spot" : "spots"} × ₦100
          </span>
          <span className="font-display text-xl text-primary">{totalNairaDisplay}</span>
        </div>

        {conflictError && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            This coin was just claimed — pick another spot on the heart.
          </p>
        )}

        {errorMessage && !conflictError && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={!canCheckout}
          onClick={handleCheckout}
        >
          {spotCount < MIN_SPOTS
            ? `Select ${MIN_SPOTS - spotCount} more spot${MIN_SPOTS - spotCount === 1 ? "" : "s"} to continue`
            : `Pay ${totalNairaDisplay} — Secure My LoveCoins`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Minimum purchase: {MIN_SPOTS} spots (₦{(MIN_SPOTS * COIN_PRICE_KOBO) / 100})
        </p>
      </div>
    </Modal>
  );
}
