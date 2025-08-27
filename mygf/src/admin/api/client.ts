// src/admin/api/client.ts
import axios from 'axios';
import { ensureCsrfToken, getCsrfToken } from '../../config/csrf';
import { logAxiosMutation } from './audit';

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'),
  withCredentials: true,
});

// Log mutations (best-effort)
api.interceptors.response.use(
  (r) => {
    try { logAxiosMutation(true, r.config, r); } catch {}
    return r;
  },
  (err) => {
    try { logAxiosMutation(false, err?.config, err); } catch {}
    // Do NOT wrap auth 401s into new Error (keeps console cleaner)
    const status = err?.response?.status;
    const url: string = err?.config?.url || "";
    if (status === 401 && (url.includes('/auth/refresh') || url.includes('/auth/check'))) {
      return Promise.reject(err);
    }
    return Promise.reject(err);
  }
);

// Auto-attach CSRF header on unsafe methods
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post','put','patch','delete'].includes(method)) {
    await ensureCsrfToken();
    const token = getCsrfToken();
    config.headers = config.headers ?? {};
    (config.headers as any)['X-CSRF-Token'] = token;
  }
  return config;
});

// 401 -> refresh -> retry once (quiet)
let refreshing = false;
let queue: any[] = [];
function enqueue(config:any){return new Promise((resolve)=>{queue.push({resolve,config})})}
function flush(){const q=[...queue];queue=[];q.forEach(i=>i.resolve(i.config))}

api.interceptors.response.use(
  (r)=>r,
  async (error)=>{
    const {config, response} = error || {};
    const status = response?.status as number | undefined;
    const url: string = config?.url || '';

    // let the auth endpoints bubble up quietly
    if (!status || status !== 401 || (config as any)?._retry || url.includes('/auth/refresh') || url.includes('/auth/check')) {
      return Promise.reject(error);
    }

    (config as any)._retry = true;

    if (refreshing){
      await enqueue(config);
      return api(config);
    }

    refreshing = true;
    try {
      await api.post('/auth/refresh', {});
      flush();
      return api(config);
    } finally {
      refreshing = false;
    }
  }
);
