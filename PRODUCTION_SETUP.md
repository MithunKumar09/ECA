# Production Environment Setup Guide

## Issue
The frontend on Vercel cannot communicate with the backend on Render due to:
1. **CORS Configuration**: Backend is not allowing requests from Vercel origin
2. **API URL Configuration**: Frontend doesn't know where the backend is located

## Solution

### 1. Backend Configuration (Render)

Set the `CORS_ORIGIN` environment variable on your Render backend service:

**Environment Variable:**
```
CORS_ORIGIN=https://eca-n7dt.vercel.app,https://mygangoor.com,https://www.mygangoor.com
```

**How to set on Render:**
1. Go to your Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Add/Update `CORS_ORIGIN` with comma-separated allowed origins
5. Save and redeploy

**Note:** Include all domains where your frontend is hosted:
- Vercel preview/deployment URL: `https://eca-n7dt.vercel.app`
- Production domain: `https://mygangoor.com`
- Production domain with www: `https://www.mygangoor.com`

### 2. Frontend Configuration (Vercel)

Set the `VITE_API_URL` environment variable on your Vercel project:

**Environment Variable:**
```
VITE_API_URL=https://your-backend-service.onrender.com
```

**Important:** Use the base URL WITHOUT `/api` suffix:
- ✅ Correct: `https://your-backend-service.onrender.com`
- ❌ Wrong: `https://your-backend-service.onrender.com/api`

The code automatically appends `/api` to create the API base URL.

**How to set on Vercel:**
1. Go to your Vercel project dashboard
2. Go to "Settings" → "Environment Variables"
3. Add `VITE_API_URL` with your Render backend URL (without trailing slash)
4. Apply to Production, Preview, and Development environments
5. Redeploy your application

### 3. Required: Cross-Site Cookie Support (Render Backend)

For cross-origin requests (Vercel frontend → Render backend), cookies must use `SameSite=None; Secure`. Set:

```
CROSS_SITE=1
```

This allows CSRF cookies to work across different domains.

### 4. Required: Trust Proxy (Render Backend)

If your Render backend is behind a proxy/load balancer, set:

```
TRUST_PROXY=1
```

This ensures cookies work correctly with `Secure` flag in production.

**Important:** Make sure your `VITE_API_URL` on Vercel does NOT include `/api` at the end. It should be:
- ✅ Correct: `https://your-backend-service.onrender.com`
- ❌ Wrong: `https://your-backend-service.onrender.com/api`

## Testing

After setting these variables:

1. **Redeploy both services**
   - Render backend (automatic after env var change, or trigger manually)
   - Vercel frontend: `vercel --prod`

2. **Test API connection**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Try logging in
   - Check that API requests go to Render backend (not relative `/api`)
   - Verify responses are JSON (not HTML error pages)

3. **Check CORS headers**
   - In Network tab, look at response headers
   - Should see `Access-Control-Allow-Origin` with your Vercel domain

## Troubleshooting

### Still getting 403 errors?
- Verify `CORS_ORIGIN` includes the exact domain (with https://)
- Check for typos in the environment variable
- Make sure you redeployed after setting the variable

### Still getting "Failed to fetch" or network errors?
- Verify `VITE_API_URL` points to correct Render backend URL
- Check that Render backend is running and accessible
- Test backend URL directly in browser: `https://your-backend.onrender.com (- should return some response, maybe 404, but not connection error)

### API requests still going to relative `/api`?
- Verify `VITE_API_URL` is set correctly on Vercel
- Check Vercel build logs to see if env var is being read
- Clear browser cache and hard refresh (Ctrl+Shift+R)

## Additional Notes

### Google OAuth Configuration
You'll also need to add your Vercel domain to Google Cloud Console:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Select your OAuth 2.0 Client ID
3. Add to "Authorized JavaScript origins":
   - `https://eca-n7dt.vercel.app`
   - `https://mygangoor.com`
   - `https://www.mygangoor.com`

### Local Development
These environment variables are optional for local development:
- `CORS_ORIGIN` defaults to `http://localhost:5173` in dev mode
- `VITE_API_URL` can be unset (uses relative `/api` via Vite proxy)

