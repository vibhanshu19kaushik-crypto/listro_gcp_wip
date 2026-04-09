# Error Analysis and Fixes

## Summary of Issues

You have **3 main issues** in your deployed application:

### 1. **405 Method Not Allowed - `/api/user-claimed-asins`**
- **Error**: `POST https://listrov3-frontend-648176215467.asia-south1.run.app/api/user-claimed-asins 405 (Method Not Allowed)`
- **Root Cause**: The frontend is trying to POST to itself instead of the backend API
- **Impact**: User claimed ASINs feature is broken

### 2. **CORS Error - `/api/gcp/sellers`**
- **Error**: `The 'Access-Control-Allow-Origin' header has a value 'http://localhost:5173' that is not equal to the supplied origin`
- **Root Cause**: The backend CORS is configured with `http://localhost:5173` but the frontend is running on `https://listrov3-frontend-648176215467.asia-south1.run.app`
- **Impact**: Cannot fetch sellers from GCP backend

### 3. **500 Internal Server Error - `/api/gcp/sellers`**
- **Error**: `GET https://listrov3-node-api-648176215467.asia-south1.run.app/api/gcp/sellers net::ERR_FAILED 500`
- **Root Cause**: The CORS preflight is failing, and likely the backend is also not properly configured for production
- **Impact**: Seller list page is non-functional

---

## Root Cause Analysis

### Issue #1: Wrong API Base URL in Frontend
The frontend config (`src/api/config.js`) is reading from environment variables:
```javascript
export const NODE_API_BASE_URL = import.meta.env.VITE_NODE_BACKEND_URL;
```

**Problem**: The `VITE_NODE_BACKEND_URL` environment variable is **not being set during build**, or it's pointing to the wrong URL.

### Issue #2 & #3: CORS Configuration Mismatch
The backend (`backend/server.js`) has hardcoded fallback CORS:
```javascript
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
```

**Problem**: 
- The `FRONTEND_ORIGIN` environment variable is **not set in production**
- It falls back to `http://localhost:5173` (development origin)
- Your production frontend is `https://listrov3-frontend-648176215467.asia-south1.run.app`

---

## Solutions

### Fix #1: Set Environment Variables in Vite Build

**File**: Create or update `.env.production`

```env
VITE_NODE_BACKEND_URL=https://listrov3-node-api-648176215467.asia-south1.run.app
VITE_PYTHON_BACKEND_URL=https://listrov3-python-api-648176215467.asia-south1.run.app
```

**Or during build**:
```bash
VITE_NODE_BACKEND_URL=https://listrov3-node-api-648176215467.asia-south1.run.app \
VITE_PYTHON_BACKEND_URL=https://listrov3-python-api-648176215467.asia-south1.run.app \
npm run build
```

### Fix #2: Set FRONTEND_ORIGIN Environment Variable in Cloud Run

**For Node.js backend deployment** (Cloud Run):
```bash
gcloud run deploy listrov3-node-api \
  --set-env-vars="FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app" \
  --image gcr.io/your-project/listrov3-node-api:latest \
  --region asia-south1
```

**For Python backend deployment** (if it also has CORS):
```bash
gcloud run deploy listrov3-python-api \
  --set-env-vars="FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app" \
  --image gcr.io/your-project/listrov3-python-api:latest \
  --region asia-south1
```

### Fix #3: Update CORS to Be More Flexible (Recommended for Production)

**File**: `backend/server.js` (lines 29-35)

Change from:
```javascript
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
```

To:
```javascript
// Allow both development and production origins
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_ORIGIN || 'https://listrov3-frontend-648176215467.asia-south1.run.app'
  ];
  return origins.filter(Boolean);
};

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
```

---

## Deployment Checklist

### Before Redeploying:

- [ ] Set `VITE_NODE_BACKEND_URL` and `VITE_PYTHON_BACKEND_URL` during Vite build
- [ ] Set `FRONTEND_ORIGIN` environment variable in Cloud Run
- [ ] Update CORS configuration in `backend/server.js`
- [ ] Redeploy frontend with correct environment variables
- [ ] Redeploy backend with correct environment variables
- [ ] Test CORS requests in browser console

### Verification Commands:

```bash
# Check frontend environment variables were set
curl https://listrov3-frontend-648176215467.asia-south1.run.app -s | grep "VITE_NODE_BACKEND_URL"

# Test CORS preflight
curl -X OPTIONS https://listrov3-node-api-648176215467.asia-south1.run.app/api/gcp/sellers \
  -H "Origin: https://listrov3-frontend-648176215467.asia-south1.run.app" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Test actual request
curl -X GET https://listrov3-node-api-648176215467.asia-south1.run.app/api/gcp/sellers \
  -H "Origin: https://listrov3-frontend-648176215467.asia-south1.run.app"
```

---

## Quick Reference: Your URLs

- **Frontend**: `https://listrov3-frontend-648176215467.asia-south1.run.app`
- **Node API**: `https://listrov3-node-api-648176215467.asia-south1.run.app`
- **Python API**: `https://listrov3-python-api-648176215467.asia-south1.run.app` (if applicable)

