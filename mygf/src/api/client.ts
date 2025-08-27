// src/api/client.ts
import axios, { AxiosError } from "axios";
import { SERVER_URL } from "../components/constants";
import { ensureCsrfToken, getCsrfToken } from "../config/csrf";

const baseURL = SERVER_URL ? `${SERVER_URL}/api` : "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ---- ALWAYS attach CSRF header (even on GET) ----
api.interceptors.request.use(async (config) => {
  try {
    await ensureCsrfToken();
    const token = getCsrfToken();
    if (token) {
      (config.headers as any) = config.headers ?? {};
      (config.headers as any)["X-CSRF-Token"] = token;
    }
  } catch {}
  return config;
});

// ---- Helpers for refresh + CSRF retry ----
let isRefreshing = false;
const waiters: Array<() => void> = [];
const waitForRefresh = () => new Promise<void>((resolve) => waiters.push(resolve));
const releaseWaiters = () => { while (waiters.length) waiters.shift()!(); };

async function retryWithFreshCsrf(cfg: any) {
  if (cfg._csrfRetry) throw new Error("CSRF retry already attempted");
  cfg._csrfRetry = true;
  await ensureCsrfToken(true);
  const t = getCsrfToken();
  (cfg.headers ??= {});
  delete (cfg.headers as any)["X-CSRF-Token"];
  (cfg.headers as any)["X-CSRF-Token"] = t;
  return api.request(cfg);
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    const cfg = (error?.config ?? {}) as any;
    const status = error?.response?.status as number | undefined;
    const url: string = (cfg?.url || "").toString();
    const method = (cfg?.method || "get").toLowerCase();

    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/mfa") ||
      url.includes("/auth/totp") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/check");

    // CSRF hardening: if unsafe method failed with 403, refresh CSRF and retry once
    if (status === 403 && ["post","put","patch","delete"].includes(method) && !cfg._csrfRetry) {
      try {
        return await retryWithFreshCsrf(cfg);
      } catch {
        // fallthrough
      }
    }

    // For expected unauth on auth endpoints, reject quietly
    if (status === 401 && isAuthEndpoint) {
      return Promise.reject(error); // callers should catch; no extra wrapping
    }

    // 401 -> try refresh once, then retry original request
    if (status === 401 && !cfg._retry && !isAuthEndpoint) {
      cfg._retry = true;

      if (isRefreshing) {
        await waitForRefresh();
        return api.request(cfg);
      }

      isRefreshing = true;
      try {
        await api.post("/auth/refresh", {}, { withCredentials: true });
        releaseWaiters();
        return api.request(cfg);
      } catch (e) {
        releaseWaiters();
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
