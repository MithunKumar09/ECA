// src/hooks/useAuthHydration.ts
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/store";
import { checkSession } from "../api/auth";

/**
 * Public routes: we avoid calling /auth/check unless we know the user
 * previously had a refresh cookie (localStorage hint).
 */
const PUBLIC_PREFIXES = ["/", "/home", "/login", "/signup", "/forgot-password", "/reset-password"];
const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/**
 * Module-scoped guards so multiple components don't all call /auth/check
 */
let hydratedOnce = false;
let inflight: Promise<void> | null = null;

export function resetAuthHydration() {
  hydratedOnce = false;
  inflight = null;
}

/**
 * One-time auth hydration from cookie-based session.
 * - On public pages, hydrate only if we previously had a session.
 * - Silently swallow 401s.
 */
export function useAuthHydration() {
  const { user, login: setAuthUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(hydratedOnce || !!user);
  const ran = useRef(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (hydratedOnce || user) {
      setIsHydrated(true);
      return;
    }

    const onPublic = isPublicPath(pathname);
    const hadSession = localStorage.getItem("auth:hasRefresh") === "1";

    // On public screens, skip hydration if we never had a refresh cookie
    if (onPublic && !hadSession) {
      hydratedOnce = true;
      setIsHydrated(true);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const run = async () => {
      if (inflight) {
        await inflight;
      } else {
        inflight = (async () => {
          try {
            const res = await checkSession(); // GET /api/auth/check
            if (!cancelled && res?.ok && res.user) {
              // Cookie-based; store user only
              setAuthUser({ user: res.user, tokens: undefined } as any);
              // remember we had a session
              localStorage.setItem("auth:hasRefresh", "1");
            }
          } catch {
            // ignore (401 etc.)
          } finally {
            hydratedOnce = true;
            inflight = null;
          }
        })();
        await inflight;
      }

      if (!cancelled) {
        setIsLoading(false);
        setIsHydrated(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user, setAuthUser, pathname]);

  return { user: user || null, isHydrated, isLoading };
}
