// src/api/publicCatalog.ts

// Build a base URL without a trailing slash.
// In dev, you can leave VITE_API_URL empty and rely on your Vite proxy for "/api".
const PUBLIC_BASE =
  (import.meta as any)?.env?.VITE_API_URL?.replace(/\/$/, "") || "/api";

export type FeaturedCourse = {
  id: string;
  slug: string | null;
  title: string;
  courseType: "free" | "paid";
  price: number;                // in paise
  coverUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  durationText?: string | null;
};

export type FeaturedPayload = {
  paid: FeaturedCourse[];
  free: FeaturedCourse[];
};

/**
 * Public fetch — no auth, no CSRF, no cookies.
 * GET /api/public/catalog/featured → { paid: [...3], free: [...3] }
 */
export async function getFeaturedCourses(): Promise<FeaturedPayload> {
  try {
    const res = await fetch(`${PUBLIC_BASE}/public/catalog/featured`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",      // ← ensure we never require cookies/auth
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) return { paid: [], free: [] };

    const json = await res.json().catch(() => ({} as any));
    return {
      paid: Array.isArray(json?.paid) ? json.paid : [],
      free: Array.isArray(json?.free) ? json.free : [],
    };
  } catch {
    return { paid: [], free: [] };
  }
}
