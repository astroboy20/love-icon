/**
 * Redux store configuration.
 *
 * Combines all RTK Query API slice reducers (authApi, coinsApi, fameApi,
 * paymentsApi, sharingApi) with RTK UI slices (coinsSlice, authSlice).
 * RTK Query middleware is registered for all API slices so that cache
 * invalidation, polling, and subscriptions work correctly.
 *
 * A listener middleware is also registered to handle cross-cutting concerns:
 *   - On `auth/markSessionExpired`: reset all API caches to clear user-specific
 *     mutable data (Requirements 18.5, 20.4, 21.20).
 */
import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

// RTK Query API slices
import { authApi } from "@/features/auth/api/authApi";
import { coinsApi } from "@/features/coins/api/coinsApi";
import { fameApi } from "@/features/fame/api/fameApi";
import { paymentsApi } from "@/features/payments/api/paymentsApi";
import { sharingApi } from "@/features/sharing/api/sharingApi";

// RTK UI slices
import { coinsReducer } from "@/features/coins/slices/coinsSlice";
import { authReducer, markSessionExpired } from "@/features/auth/slices/authSlice";

// ---------------------------------------------------------------------------
// Session-expiry listener middleware (Requirements 18.5, 20.4, 21.20)
//
// When `markSessionExpired` is dispatched (by the supabaseBaseQuery 401
// interceptor), reset all RTK Query API caches so that user-specific mutable
// data (purchase orders, coins, notes, reactions) is not visible after the
// session expires. The browser is simultaneously redirected to /auth by
// supabaseBaseQuery, so the cleared cache is never read by the UI again.
// ---------------------------------------------------------------------------
const sessionExpiryListener = createListenerMiddleware();

sessionExpiryListener.startListening({
  actionCreator: markSessionExpired,
  effect: (_action, listenerApi) => {
    // Reset all API caches to clear any mutable user-specific cached data.
    listenerApi.dispatch(authApi.util.resetApiState());
    listenerApi.dispatch(coinsApi.util.resetApiState());
    listenerApi.dispatch(fameApi.util.resetApiState());
    listenerApi.dispatch(paymentsApi.util.resetApiState());
    listenerApi.dispatch(sharingApi.util.resetApiState());
  },
});

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
      // Session-expiry cache-clear listener runs before API middleware so the
      // cache is flushed before any pending queries re-run.
      .prepend(sessionExpiryListener.middleware)
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
