# CORS and API Path Fix Summary

## Issues Identified

1. **CORS Preflight Failures**: Backend not responding correctly to OPTIONS requests
2. **Double `/api/api/` Path**: Frontend code fix needs redeploy
3. **Missing Environment Variables**: Backend needs CORS_ORIGIN configured

## Fixes Applied

### 1. Backend CORS Configuration (✅ Fixed in `backend/server.js`)

- Added explicit `app.options('*', cors(corsOptions))` to handle all preflight requests
- Added `allowedHeaders` to explicitly allow required headers
- Added logging to help debug CORS issues in production
- Improved error messages when origins are rejected

### 2. Frontend API Path Normalization (✅ Fixed in `mygf/src/config/env.ts`)

- Added `normalizeApiRoot()` function to strip `/api` suffix if present
- Prevents double `/api/api/` paths
- Handles trailing slashes correctly

## Required Actions

### On Render (Backend) - Set These Environment Variables:

```bash
CORS_ORIGIN=https://eca-n7dt.vercel.app,https://mygangoor.com,https://www.mygangoor.com
CROSS_SITE=1
TRUST_PROXY=1
NODE_ENV=production
```

**Steps:**
1. Go to Render Dashboard → Your Backend Service
2. Click "Environment" tab
3. Add/Update the variables above
4. Save (this will trigger a redeploy)
5. Check logs after redeploy - you should see: `[cors] Configured allowed origins: https://eca-n7dt.vercel.app, ...`

### On Vercel (Frontend) - Set This Environment Variable:

```bash
VITE_API_URL=https://eca-uvco.onrender.com
```

**Important:** 
- Use base URL WITHOUT `/api` suffix
- ✅ Correct: `https://eca-uvco.onrender.com`
- ❌ Wrong: `https://eca-uvco.onrender.com/api`

**Steps:**
1. Go to Vercel Dashboard → Your Project
2. Go to "Settings" → "Environment Variables"
3. Add/Update `VITE_API_URL`
4. Apply to Production, Preview, and Development
5. Redeploy: `vercel --prod`

## Testing After Deployment

### 1. Check Backend Logs (Render)

After backend redeploys, look for this in startup logs:
```
[cors] Configured allowed origins: https://eca-n7dt.vercel.app, https://mygangoor.com, https://www.mygangoor.com
```

If you see:
```
⚠️ NONE - CORS will reject all requests!
```
Then `CORS_ORIGIN` is not set correctly.

### 2. Test API Connection

1. Open browser DevTools (F12) → Network tab
2. Try to log in
3. Check the request:
   - URL should be: `https://eca-uvco.onrender.com/api/auth/login` (NOT double `/api/api/`)
   - Preflight OPTIONS request should return `204` status
   - Actual POST request should go through

### 3. Verify CORS Headers

In Network tab, check response headers for the login request:
- `Access-Control-Allow-Origin: https://eca-n7dt.vercel.app`
- `Access-Control-Allow-Credentials: true`

## Troubleshooting

### Still Getting CORS Errors?

1. **Check CORS_ORIGIN is set correctly:**
   - No spaces after commas
   - Exact domain match (including `https://`)
   - Check Render logs for the warning message

2. **Check OPTIONS requests:**
   - In Network tab, filter by "OPTIONS"
   - Should return `204` status
   - Should have `Access-Control-Allow-Origin` header

3. **Verify VITE_API_URL:**
   - Check Vercel environment variables
   - Should NOT end with `/api`
   - Check browser console - API calls should go to correct URL

### Still Seeing `/api/api/` in Backend Logs?

- Frontend needs to be redeployed after the env.ts fix
- Clear browser cache
- Check that `VITE_API_URL` doesn't include `/api`

## Expected Behavior After Fix

✅ Preflight OPTIONS request succeeds with 204  
✅ Actual POST request succeeds  
✅ CSRF token is fetched and attached  
✅ Login works correctly  
✅ No CORS errors in console  

## Notes

- The `CROSS_SITE=1` setting makes cookies use `SameSite=None; Secure` which is required for cross-origin requests
- The `TRUST_PROXY=1` setting ensures Render's proxy headers are trusted for setting Secure cookies
- Frontend code changes require a rebuild and redeploy on Vercel
- Backend code changes require a redeploy on Render (automatic when env vars change)

