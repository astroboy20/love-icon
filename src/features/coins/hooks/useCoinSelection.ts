/**
 * Hook wrapping coin selection state from coinsSlice.
 *
 * Provides a clean interface for components that need to read or modify
 * the multi-spot selection state managed by the Redux store.
 *
 * Requirements: 11.1, 11.6, 22.8
 */
import { useAppDispatch, useAppSelector } from "@/app/store";
import {
  toggleCoinSelection,
  clearSelection,
  openClaimFlow,
  closeClaimFlow,
  selectSelectedCoinNumbers,
  selectIsClaimFlowOpen,
  selectSelectedCoinCount,
} from "@/features/coins/slices/coinsSlice";
import { MIN_SPOTS } from "@/features/coins/utils/coinValidation";

export interface UseCoinSelectionReturn {
  /** Currently selected coin numbers. */
  selectedCoinNumbers: number[];
  /** Number of spots currently selected. */
  selectedCount: number;
  /** Whether the ClaimFlow modal is open. */
  isClaimFlowOpen: boolean;
  /** Whether the minimum spot count (10) has been met. */
  isMinMet: boolean;
  /** Toggle a coin number in/out of the selection. */
  toggleCoinSelection: (coinNumber: number) => void;
  /** Clear all selected coin numbers. */
  clearSelection: () => void;
  /** Open the ClaimFlow modal. */
  openClaimFlow: () => void;
  /** Close the ClaimFlow modal and clear selection. */
  closeClaimFlow: () => void;
}

/**
 * Hook that wraps `coinsSlice` selection state and actions.
 *
 * @example
 * const { selectedCoinNumbers, isMinMet, toggleCoinSelection } = useCoinSelection();
 */
export function useCoinSelection(): UseCoinSelectionReturn {
  const dispatch = useAppDispatch();
  const selectedCoinNumbers = useAppSelector(selectSelectedCoinNumbers);
  const isClaimFlowOpen = useAppSelector(selectIsClaimFlowOpen);
  const selectedCount = useAppSelector(selectSelectedCoinCount);

  return {
    selectedCoinNumbers,
    selectedCount,
    isClaimFlowOpen,
    isMinMet: selectedCount >= MIN_SPOTS,
    toggleCoinSelection: (coinNumber: number) => dispatch(toggleCoinSelection(coinNumber)),
    clearSelection: () => dispatch(clearSelection()),
    openClaimFlow: () => dispatch(openClaimFlow()),
    closeClaimFlow: () => dispatch(closeClaimFlow()),
  };
}
