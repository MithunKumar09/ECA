// src/config/csrf.ts
let _cached: string | null = null;

function readCookie(cookieName: string): string | null {
  const raw = typeof document !== "undefined" ? document.cookie : "";
  if (!raw) return null;
  const parts = raw.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    if (key === cookieName) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

// Prefer the API origin (prod); in dev it will be empty and we’ll hit the Vite proxy.
const API_BASE: string =
  (import.meta as any)?.env?.VITE_API_URL
    ? String((import.meta as any).env.VITE_API_URL).replace(/\/+$/, "")
    : "";

export function getCsrfToken(): string | null {
  return _cached;
}

export function invalidateCsrfToken(): void {
  _cached = null;
}

/**
 * Ensure we have a CSRF token:
 * - In prod: fetch {API_BASE}/csrf with credentials; read JSON { token | csrfToken } and cache it.
 * - In dev: fall back to reading the cookie Vite set on localhost.
 */
export async function ensureCsrfToken(force = false): Promise<void> {
  if (!force && _cached) return;

  const url = API_BASE ? `${API_BASE}/csrf` : "/csrf";
  try {
    const res = await fetch(url, { credentials: "include", method: "GET" });

    let tok: string | null = null;
    try {
      const data: any = await res.json();
      tok = (data && (data.token || data.csrfToken)) || null;
    } catch {
      // ignore JSON parse errors; fall back below
    }

    // Dev fallback (same-site cookie via Vite proxy)
    if (!tok) tok = readCookie("__Host-csrf") || readCookie("csrf");

    if (tok) _cached = tok;
  } catch {
    // Last-ditch dev fallback
    const tok = readCookie("__Host-csrf") || readCookie("csrf");
    if (tok) _cached = tok;
  }
}
