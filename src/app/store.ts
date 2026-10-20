/**
 * Redux store configuration.
 *
 * Combines all RTK Query API slice reducers (authApi, coinsApi, fameApi,
 * paymentsApi, sharingApi) with RTK UI slices (coinsSlice, authSlice).
 * RTK Query middleware is registered for all API slices so that cache
 * invalidation, polling, and subscriptions work correctly.
 */
import { configureStore } from "@reduxjs/toolkit";
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

// RTK Query API slices
import { authApi } from "@/features/auth/api/authApi";
import { coinsApi } from "@/features/coins/api/coinsApi";
import { fameApi } from "@/features/fame/api/fameApi";
import { paymentsApi } from "@/features/payments/api/paymentsApi";
import { sharingApi } from "@/features/sharing/api/sharingApi";

// RTK UI slices
import { coinsReducer } from "@/features/coins/slices/coinsSlice";
import { authReducer } from "@/features/auth/slices/authSlice";

export const store = configureStore({
  reducer: {
    // ---- RTK Query API reducers ----
    [authApi.reducerPath]: authApi.reducer,
    [coinsApi.reducerPath]: coinsApi.reducer,
    [fameApi.reducerPath]: fameApi.reducer,
    [paymentsApi.reducerPath]: paymentsApi.reducer,
    [sharingApi.reducerPath]: sharingApi.reducer,

    // ---- RTK UI slice reducers ----
    coins: coinsReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(coinsApi.middleware)
      .concat(fameApi.middleware)
      .concat(paymentsApi.middleware)
      .concat(sharingApi.middleware),
});

// ---------------------------------------------------------------------------
// Type helpers — used throughout the app to get typed dispatch / selector.
// ---------------------------------------------------------------------------
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Typed version of `useDispatch` — use this instead of the plain hook. */
export const useAppDispatch: () => AppDispatch = useDispatch;

/** Typed version of `useSelector` — use this instead of the plain hook. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
