// src/auth/RequireOrgUser.tsx
import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./store";
import type { Role } from "./store";

type RolePattern = Role | RegExp;

type Props = {
  children: React.ReactNode;
  /** What to show while we hydrate/check auth (e.g. a skeleton/spinner) */
  loading?: React.ReactNode;
  /** Allowed roles; default is orguser only. You can pass ['orguser','student'] if needed. */
  allowedRoles?: RolePattern[];
  /** Where to send authenticated-but-not-allowed users (defaults to /dashboard). */
  onDeniedRedirectTo?: string;
  /** Where to send unauthenticated users (defaults to /login). */
  onLoginRedirectTo?: string;
};

// PHASE 3: same stale-revalidation threshold as Shell.
const REVALIDATE_MS = 5 * 60 * 1000; // 5 minutes

export default function RequireOrgUser({
  children,
  loading = null,
  allowedRoles = ["orguser"],
  onDeniedRedirectTo = "/dashboard",
  onLoginRedirectTo = "/login",
}: Props) {
  const { status, user, lastChecked, hydrate } = useAuth();
  const location = useLocation();

  // PHASE 3: re-validate on idle OR when session hasn't been checked recently.
  // hydrate() is idempotent (guards against status === "checking") so no
  // extra ref is needed to prevent double-invoke in StrictMode.
  useEffect(() => {
    if (
      status === "idle" ||
      (status === "ready" && Date.now() - lastChecked > REVALIDATE_MS)
    ) {
      hydrate();
    }
  }, [status, lastChecked, hydrate]);

  // Hard gate: do not mount children until auth check completed
  if (status !== "ready") {
    return <>{loading}</>;
  }

  // Not logged in → go to login (preserve next)
  if (!user) {
    return <Navigate to={onLoginRedirectTo} state={{ from: location }} replace />;
  }

  // Role check
  const role = String(user.role || "").toLowerCase();

  const allowed = allowedRoles.some((pat) =>
    typeof pat === "string"
      ? role === String(pat).toLowerCase()
      : pat.test(role)
  );

  if (!allowed) {
    return <Navigate to={onDeniedRedirectTo} replace />;
  }

  // ✅ Authenticated + allowed → render protected content
  return <>{children}</>;
}
