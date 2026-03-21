// src/store/enrollmentStore.ts
// Single source of truth for student enrollment / premium-access state.
//
// Rules (enforced here, not by callers):
//   • premiumIds is ALWAYS a union — never fully replaced.
//   • IDs are ALWAYS stored as String(...) for consistent matching.
//   • fetchActive() is idempotent: concurrent calls are deduplicated by the
//     loading flag and the merge-only setFromServer prevents flickering.
import { create } from "zustand";
import { api } from "../api/client";

type EnrollmentStore = {
  /** Set of course IDs the current user has premium (paid) access to. */
  premiumIds: Set<string>;

  /**
   * Monotonic counter incremented by refresh().
   * Components can add it to their useEffect dependency array to re-fetch
   * enrollment state from the server (e.g., 4 s after a payment).
   */
  tick: number;

  /** True while fetchActive() is in-flight. */
  loading: boolean;

  /**
   * Instantly unlocks a course in the UI (optimistic update).
   * Call immediately after payment confirmation — before any server round-trip.
   */
  addOptimistic: (id: string) => void;

  /**
   * Merges server-confirmed IDs into premiumIds.
   * NEVER replaces — keeps any optimistically added IDs that the server may
   * not have committed yet.
   */
  setFromServer: (ids: string[]) => void;

  /**
   * Increments tick → triggers re-fetch in subscribed components.
   * Call with a setTimeout delay so the backend has time to commit the
   * enrollment before we ask for it.
   */
  refresh: () => void;

  /**
   * Fetches /student/enrollments/active and merges results into premiumIds.
   * Safe to call from multiple components simultaneously — deduplicated by
   * the loading flag.
   */
  fetchActive: () => Promise<void>;
};

export const useEnrollmentStore = create<EnrollmentStore>((set, get) => ({
  premiumIds: new Set(),
  tick: 0,
  loading: false,

  addOptimistic: (id) =>
    set((s) => ({ premiumIds: new Set([...s.premiumIds, String(id)]) })),

  setFromServer: (ids) =>
    set((s) => {
      const merged = new Set(s.premiumIds);
      ids.forEach((id) => { if (id) merged.add(String(id)); });
      return { premiumIds: merged };
    }),

  refresh: () =>
    set((s) => ({ tick: s.tick + 1 })),

  fetchActive: async () => {
    // Deduplicate concurrent calls
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await api.get("/student/enrollments/active", { withCredentials: true });
      const items: any[] = Array.isArray(res?.data?.items) ? res.data.items : [];
      const ids = items
        .filter((e) =>
          e.premium === true ||
          e.status === "premium" ||
          e.status === "paid" ||
          e.paymentStatus === "paid" ||
          e.access === "premium" ||
          !!e.paidAt
        )
        .map((e) => String(e.courseId || e.course?.id || ""))
        .filter(Boolean);
      // Merge — never replace (preserves optimistic IDs)
      get().setFromServer(ids);
    } catch {
      // Silently fail — do NOT clear premiumIds; preserves any optimistic state
    } finally {
      set({ loading: false });
    }
  },
}));
