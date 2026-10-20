/**
 * RTK UI slice for coin selection state.
 *
 * Manages the HeartGrid multi-spot selection and the ClaimFlow modal open
 * state. This is pure UI state — no server calls, no caching. Server state
 * (the actual coin records) lives in `coinsApi`.
 *
 * State shape:
 *   selectedCoinNumbers: number[]  — coin spots currently selected by the user
 *   isClaimFlowOpen: boolean       — whether the ClaimFlow modal is open
 *
 * Actions:
 *   toggleCoinSelection(coinNumber) — add or remove a spot from the selection
 *   clearSelection()                — reset selection to empty array
 *   openClaimFlow()                 — open the ClaimFlow modal
 *   closeClaimFlow()                — close the modal and clear selection
 *
 * Requirements: 11.1, 11.6, 22.8, 22.13
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface CoinsUIState {
  selectedCoinNumbers: number[];
  isClaimFlowOpen: boolean;
}

const initialState: CoinsUIState = {
  selectedCoinNumbers: [],
  isClaimFlowOpen: false,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const coinsSlice = createSlice({
  name: "coins",
  initialState,
  reducers: {
    /**
     * Add a coin number to the selection if it is not already selected,
     * or remove it if it is. Enables multi-spot selection on the HeartGrid.
     */
    toggleCoinSelection: (state, action: PayloadAction<number>) => {
      const coinNumber = action.payload;
      const index = state.selectedCoinNumbers.indexOf(coinNumber);
      if (index === -1) {
        state.selectedCoinNumbers.push(coinNumber);
      } else {
        state.selectedCoinNumbers.splice(index, 1);
      }
    },

    /**
     * Remove all selected coin spots. Called after a successful purchase or
     * when the user explicitly resets the selection.
     */
    clearSelection: (state) => {
      state.selectedCoinNumbers = [];
    },

    /**
     * Open the ClaimFlow modal. The HeartGrid dispatches this when the user
     * clicks "Claim selected spots" (or the first selected spot).
     */
    openClaimFlow: (state) => {
      state.isClaimFlowOpen = true;
    },

    /**
     * Close the ClaimFlow modal and clear the selection.
     * This ensures a fresh state for the next claim attempt.
     */
    closeClaimFlow: (state) => {
      state.isClaimFlowOpen = false;
      state.selectedCoinNumbers = [];
    },
  },
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const { toggleCoinSelection, clearSelection, openClaimFlow, closeClaimFlow } =
  coinsSlice.actions;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSelectedCoinNumbers = (state: RootState) => state.coins.selectedCoinNumbers;
export const selectIsClaimFlowOpen = (state: RootState) => state.coins.isClaimFlowOpen;
export const selectSelectedCoinCount = (state: RootState) =>
  state.coins.selectedCoinNumbers.length;

// ---------------------------------------------------------------------------
// Reducer (named export for store wiring)
// ---------------------------------------------------------------------------

export const coinsReducer = coinsSlice.reducer;
