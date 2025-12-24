# Docker & Environment Configuration Analysis

## 📋 Root Directory Files

### Dockerfile
- **Purpose**: Frontend container (nginx-based)
- **Base Image**: `nginx:alpine`
- **Function**: Serves built React/Vite frontend
- **Exposes**: Port 8080
- **Status**: ✅ Ready for production

### .env (Development)
```properties
VITE_NODE_BACKEND_URL=http://localhost:4000
VITE_PYTHON_BACKEND_URL=http://localhost:5000
```

### .env.production
```properties
VITE_NODE_BACKEND_URL=https://listrov3-node-api-648176215467.asia-south1.run.app
VITE_PYTHON_BACKEND_URL=https://listrov3-python-api-648176215467.asia-south1.run.app
```

---

## 📋 Backend Directory Files

### Dockerfile (Legacy - NOT RECOMMENDED)
- **Purpose**: Old nginx-based frontend build
- **Note**: ⚠️ Don't use this - use root/Dockerfile instead
- **Status**: Deprecated

### Dockerfile.node ✅ RECOMMENDED FOR NODE.JS DEPLOYMENT
```dockerfile
FROM node:20-bullseye-slim

# Installs:
# - Node.js 20 runtime
# - Python 3 + pip (for scraper.py & amz_scraper.py)
# - beautifulsoup4, requests (Python dependencies)

WORKDIR /app
EXPOSE 8080
CMD ["node", "server.js"]

ENV PORT=8080
ENV NODE_ENV=production
```

**Ideal for**: Node.js backend (server.js)
**Status**: ✅ Ready, has all dependencies for GCS + scrapers

### Dockerfile.python (USES CLOUDRUN VERSION - NEEDS CHANGE)
```dockerfile
FROM python:3.12-slim

# Currently copies:
COPY python-server-cloudrun.py ./python-server.py
```

**Current Status**: ❌ Uses python-server-cloudrun.py (older version)
**Need to change to**: ✅ Use python-server.py (newer version)

### .env (Development)
```properties
GEMINI_API_KEY=AIzaSyBkisgDPBv9NonKfBDJjgWicjpPsGKW2VM
GCP_PROJECT_ID=ops-excellence
GOOGLE_APPLICATION_CREDENTIALS=/home/ashutoshsingh/ops-excellence-sa-key.json
GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc
GOOGLE_SHEETS_TAB_NAME=Product_Data
FRONTEND_ORIGIN=http://localhost:5173
```

### .env.production (Node.js Server)
```properties
GEMINI_API_KEY=AIzaSyBkisgDPBv9NonKfBDJjgWicjpPsGKW2VM
FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app
GCP_PROJECT_ID=ops-excellence
GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc
GOOGLE_SHEETS_TAB_NAME=Product_Data
BIGQUERY_DATASET=Amazon_Listing
BIGQUERY_TABLE=amazon_product_data
NODE_ENV=production
```

### .env.python.production (Python Server)
```properties
GEMINI_API_KEY=AIzaSyBkisgDPBv9NonKfBDJjgWicjpPsGKW2VM
GCP_PROJECT_ID=ops-excellence
_LEAD_SPREADSHEET_ID=1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4
_USER_SPREADSHEET_ID=1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto
GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc
GOOGLE_SHEETS_TAB_NAME=Product_Data
FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app
FLASK_ENV=production
ENV=production
```

---

## 🔍 Python Server Comparison

### python-server.py (2,757 lines) ✅ RECOMMENDED
**Characteristics:**
- ✅ Loads .env in non-production environments: `if os.getenv("ENV", "local") != "production": load_dotenv()`
- ✅ Uses ADC (Application Default Credentials) for GCS
- ✅ Better for local development with .env files
- ✅ More complete implementation
- ✅ Includes upload_to_gcs() function with proper error handling
- ✅ Supports both local and production environments

### python-server-cloudrun.py (2,483 lines) ❌ LEGACY
**Characteristics:**
- ⚠️ Does NOT load .env (Cloud Run only approach)
- ⚠️ Slightly older version (274 lines shorter)
- ⚠️ Less flexible for local testing
- ❌ Current Dockerfile.python uses this
- ❌ Not suitable for hybrid local/production deployments

---

## 🚀 Deployment Architecture

### Current Setup
```
Frontend (React/Vite)
├─ Dockerfile (root) → Nginx container → listrov3-frontend
│
├─ Node.js Backend
│  ├─ Dockerfile.node → Node 20 + Python 3 → listrov3-node-api
│  ├─ server.js (includes GCS upload for Gold Standard images)
│  └─ Calls amz_scraper.py for image extraction
│
└─ Python Backend
   ├─ Dockerfile.python → Python 3.12 ❌ USES CLOUDRUN VERSION
   ├─ python-server.py ✅ (Better version, not used)
   └─ python-server-cloudrun.py ❌ (Currently deployed)
```

---

## 📝 Recommended Changes

### 1. Update Dockerfile.python (CRITICAL)
**Current:**
```dockerfile
COPY python-server-cloudrun.py ./python-server.py
```

**Change to:**
```dockerfile
COPY python-server.py ./python-server.py
```

**Reason**: python-server.py is newer, supports .env loading for local testing, and has better error handling.

### 2. Environment Configuration
For production Cloud Run deployment:

**Use**: `.env.python.production` 
- Properly configured for Cloud Run
- Includes all required environment variables
- Sets FLASK_ENV=production and ENV=production

---

## ✅ Deployment Checklist

- [ ] Update `backend/Dockerfile.python` to use `python-server.py` (not `python-server-cloudrun.py`)
- [ ] Ensure `backend/.env.python.production` is properly configured
- [ ] Verify `backend/Dockerfile.node` is used for Node.js backend
- [ ] Ensure `backend/.env.production` is properly configured
- [ ] Deploy Node.js backend: `gcloud run deploy listrov3-node-api --source=backend/ -f backend/Dockerfile.node ...`
- [ ] Deploy Python backend: `gcloud run deploy listrov3-python-api --source=backend/ -f backend/Dockerfile.python ...`
- [ ] Test GCS image uploads (both Node and Python)
- [ ] Monitor Cloud Run logs for successful deployments

---

## 🔧 GCS Upload Functions Status

### In python-server.py (lines 130-180)
```python
def upload_to_gcs(local_file_path, destination_blob_name):
    """Uploads a file to GCS, makes it public, and returns the public URL."""
    if not storage_client:
        raise Exception("GCS client not available")
    
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)
    # ... proper error handling for Forbidden, Exception, etc.
```

**Status**: ✅ Ready for production

### In server.js
- ✅ uploadImageToGCS() function (lines 224+)
- ✅ downloadAndUploadImageToGCS() function (lines 265+)
- ✅ GCS client initialization with ADC

**Status**: ✅ Ready for production

---

## 🎯 Summary

| Component | Current | Recommended | Action |
|-----------|---------|-------------|--------|
| Frontend Dockerfile | ✅ OK | ✅ Keep | None |
| Node.js Dockerfile | ✅ OK | ✅ Use .node | Verify in use |
| Python Dockerfile | ❌ Uses cloudrun version | ✅ Use python-server.py | **UPDATE THIS** |
| Node.js Env | ✅ OK | ✅ .env.production | Verify |
| Python Env | ✅ OK | ✅ .env.python.production | Verify |
| Node GCS Support | ✅ Ready | ✅ Deployed | Verify in use |
| Python GCS Support | ✅ Ready | ✅ Use python-server.py | Needs Dockerfile update |

