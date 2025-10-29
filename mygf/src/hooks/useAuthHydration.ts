// src/hooks/useAuthHydration.ts
import { useEffect, useState } from "react";
import { useAuth } from "../auth/store";
import { checkSession } from "../api/auth";

/**
 * Always check for existing session on page load to ensure session persistence
 * across page reloads. This ensures users stay logged in when they refresh the page.
 */
/** one-flight across the tab */
let hydrationOnce = false;

export function useAuthHydration() {
  const { user, setUser } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Always check for existing session on page load, regardless of path
    // This ensures session persistence across page reloads
    const shouldPing = !user && !hydrationOnce;

    if (!shouldPing) {
      // nothing to do; treat as hydrated
      setIsHydrated(true);
      return;
    }

    hydrationOnce = true;
    setIsLoading(true);

    (async () => {
      try {
        const res = await checkSession();
        if (!cancelled && res?.ok && res?.user) {
          setUser(res.user);
        }
      } catch {
        // ignore 401/419
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsHydrated(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, setUser]);

  return { user: user || null, isHydrated, isLoading };
}

/** Compatibility shim for places that call this after logout */
export function resetAuthHydration() {
  hydrationOnce = false;
}
