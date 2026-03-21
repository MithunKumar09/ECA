// src/hooks/useAuthHydration.ts
import { useEffect } from "react";
import { useAuth } from "../auth/store";

/**
 * PHASE 5: replaced the module-level `hydrationOnce` flag with store-driven
 * hydration. `store.status` is the single source of truth — "idle" means a
 * fresh check is needed, "checking" means one is already in flight, "ready"
 * means the check has completed. No mutable module globals, no side-channel
 * state that can go out of sync across navigations or StrictMode double-mounts.
 *
 * Delegates entirely to `store.hydrate()`, which guards against concurrent
 * calls (`if (status === "checking") return`) and stamps `lastChecked` so
 * Shell / RequireOrgUser can decide whether to re-validate.
 */
export function useAuthHydration() {
  const { user, status, hydrate } = useAuth();

  useEffect(() => {
    if (status === "idle") hydrate();
  }, [status, hydrate]);

  return {
    user: user || null,
    isHydrated: status === "ready",
    isLoading: status === "checking",
  };
}

/** Compatibility shim — no-op. Hydration state is now owned by the store. */
export function resetAuthHydration() {}
