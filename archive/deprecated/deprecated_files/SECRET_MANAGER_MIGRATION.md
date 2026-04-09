# Gemini API Authentication via Secret Manager

## Overview

This project has been refactored to use **Google Cloud Secret Manager** for Gemini API credentials instead of direct API keys. This provides:

- ✅ Enhanced security (no API keys in code or environment variables)
- ✅ Centralized credential management
- ✅ Automatic credential rotation support
- ✅ Audit logging for all credential access
- ✅ Cloud Run native integration

## Architecture

```
┌─────────────────────────────────────────┐
│    Application (Flask)                  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  secret_manager.py   │ (Credential Manager)
        │ - Retrieves secrets  │
        │ - Creates credentials│
        │ - Configures Gemini  │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────┐
        │  Google Cloud Secret Manager     │
        │  (Encrypted secret storage)      │
        │  projects/648176215467/          │
        │  secrets/listro-secret-key/      │
        └──────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Service Account JSON│
        │  (Credentials)       │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Gemini API          │
        │  (via OAuth2)        │
        └──────────────────────┘
```

## Setup Instructions

### 1. Create/Update Service Account in Secret Manager

The service account JSON should be stored in Secret Manager at:
```
projects/648176215467/secrets/listro-secret-key/versions/latest
```

**Service Account JSON format:**
```json
{
  "type": "service_account",
  "project_id": "ops-excellence",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "listro-gemini@ops-excellence.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### 2. Grant Service Account Permissions

The service account needs these IAM roles:

```bash
# Enable required APIs
gcloud services enable generativelanguage.googleapis.com --project=ops-excellence
gcloud services enable secretmanager.googleapis.com --project=ops-excellence

# Grant Gemini API access
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
  --role=roles/aiplatform.user

# Grant GCS access
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
  --role=roles/storage.objectCreator

gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
  --role=roles/storage.objectViewer
```

### 3. Cloud Run Service Account Permissions

Your Cloud Run service account needs permission to access Secret Manager:

```bash
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:648176215467-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### 4. Upload Service Account to Secret Manager

```bash
# Create the secret (first time only)
gcloud secrets create listro-secret-key \
  --project=ops-excellence \
  --replication-policy="automatic"

# Upload service account JSON
gcloud secrets versions add listro-secret-key \
  --project=ops-excellence \
  --data-file=/path/to/service-account.json

# Verify the secret
gcloud secrets versions access latest \
  --secret="listro-secret-key" \
  --project=ops-excellence
```

### 5. Environment Variables

Set these in your Cloud Run deployment (no API keys needed):

```bash
GCP_PROJECT_ID=ops-excellence
FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app
FLASK_ENV=production
ENV=production
```

### 6. Deployment

#### Local Development

```bash
# Set up ADC (Application Default Credentials)
gcloud auth application-default login

# Install dependencies
cd backend
pip install -r requirements.txt

# Run the server
python python-server.py
```

#### Cloud Run

```bash
# Build and deploy Python backend
gcloud run deploy listro-python-backend \
  --source ./backend \
  --dockerfile Dockerfile.python \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 3600 \
  --set-env-vars FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=ops-excellence,FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app
```

## File Changes Summary

### New Files
- **`backend/secret_manager.py`** - Credential manager module
  - `get_secret_from_manager()` - Retrieve secret from Secret Manager
  - `configure_gemini_with_service_account()` - Initialize Gemini
  - `verify_gemini_access()` - Verify API access
  - `get_gemini_models()` - Lazy load models

### Modified Files
- **`backend/python-server.py`**
  - ✅ Added: `from secret_manager import get_gemini_models`
  - ❌ Removed: `GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")`
  - ❌ Removed: `genai.configure(api_key=GOOGLE_API_KEY)`
  - ✅ Updated: Model initialization to use `get_gemini_models()`

- **`backend/python-server-cloudrun.py`**
  - Same changes as `python-server.py`
  - Cloud Run optimizations maintained

- **`backend/amz_metadata_scraper.py`**
  - ✅ Added: `from secret_manager import get_gemini_models`
  - ❌ Removed: `GEMINI_API_KEY` environment variable usage
  - ✅ Changed: `call_gemini()` uses initialized `text_model`
  - ✅ Fallback to simple classification if Gemini unavailable

- **`backend/pnd.py`**
  - ✅ Added: `from secret_manager import get_gemini_models`
  - ❌ Removed: `GEMINI_KEY` environment variable usage
  - ✅ Updated: Model initialization

- **`backend/Dockerfile.python`**
  - ✅ Added: `COPY backend/secret_manager.py ./secret_manager.py`

- **`backend/requirements.txt`**
  - ✅ Added: `google-cloud-secret-manager`

- **`backend/.env.production`**
  - ❌ Removed: `GEMINI_API_KEY`

- **`backend/.env.python.production`**
  - ❌ Removed: `GOOGLE_API_KEY` and `GEMINI_API_KEY`

### Unchanged Files
All other logic files remain unchanged:
- `backend/amz_scraper.py` - Image scraping (no Gemini calls)
- `backend/scraper.py` - Web scraping utilities
- `src/**` - Frontend code (no changes needed)
- Database/API endpoints - All working logic preserved

## Verification

### 1. Health Check Endpoint

```bash
curl https://your-cloud-run-url/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-27T...",
  "services": {
    "gemini_text": "gemini-2.5-flash",
    "gemini_image": "gemini-2.5-flash-image-preview",
    "gcs": "available",
    "secret_manager": "available",
    "authentication": "via_secret_manager"
  }
}
```

### 2. Test Gemini Generation

```bash
curl -X POST https://your-cloud-run-url/api/generate-title-description \
  -H "Content-Type: application/json" \
  -d '{
    "subcategory": "T-Shirt",
    "type": "title",
    "material": "Cotton",
    "color": "Blue"
  }'
```

### 3. Cloud Run Logs

```bash
gcloud run logs read listro-python-backend --region asia-south1 --limit 50
```

Look for:
- `✅ Secret retrieved successfully from Secret Manager`
- `✅ Credentials created successfully`
- `✅ Gemini API configured successfully`
- `✅ Gemini models initialized successfully via Secret Manager`

## Security Best Practices

✅ **Implemented:**
- No API keys in code
- No API keys in environment variables
- Credentials stored in Secret Manager
- IAM-based access control
- Service account separation
- Audit logging enabled

✅ **Recommended:**
- Rotate service account keys regularly
- Use Secret Manager versioning
- Enable Secret Manager audit logs
- Monitor API usage in GCP Console
- Set API quotas in GCP Console

## Troubleshooting

### "Secret not found" Error

```
Error: projects/648176215467/secrets/listro-secret-key/versions/latest not found
```

**Solution:**
1. Verify secret exists: `gcloud secrets list --project=ops-excellence`
2. Check secret version: `gcloud secrets versions list listro-secret-key --project=ops-excellence`
3. Verify Cloud Run service account has `secretmanager.secretAccessor` role

### "Credentials format invalid" Error

**Solution:**
1. Verify secret is valid JSON:
```bash
gcloud secrets versions access latest --secret="listro-secret-key" --project=ops-excellence | jq .
```
2. Ensure all required fields in service account JSON
3. Re-upload if corrupted:
```bash
gcloud secrets versions add listro-secret-key --data-file=sa.json --project=ops-excellence
```

### "Gemini API access denied" Error

**Solution:**
1. Verify service account has generative language API permissions
2. Check API is enabled:
```bash
gcloud services list --enabled --project=ops-excellence | grep generativeai
```
3. Enable if needed:
```bash
gcloud services enable generativelanguage.googleapis.com --project=ops-excellence
```

### "Permission denied on Secret Manager" Error

**Solution:**
```bash
# Grant Cloud Run default service account access
gcloud secrets add-iam-policy-binding listro-secret-key \
  --member=serviceAccount:648176215467-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=ops-excellence
```

## API Key Removal Checklist

If migrating from old API key method:

- [x] Remove `GOOGLE_API_KEY` from all .env files
- [x] Remove `GEMINI_API_KEY` from all .env files
- [x] Remove `genai.configure(api_key=...)` from all Python files
- [x] Update all files to use `secret_manager.get_gemini_models()`
- [x] Update Dockerfile to copy `secret_manager.py`
- [x] Update requirements.txt with `google-cloud-secret-manager`
- [x] Test locally with ADC
- [x] Deploy to Cloud Run
- [x] Verify health check endpoint
- [x] Test all Gemini endpoints

## Monitoring

Cloud Run automatically logs all Secret Manager access. View logs:

```bash
# Application logs
gcloud run logs read listro-python-backend --region asia-south1

# Secret Manager audit logs
gcloud logging read "resource.type=secret_manager_secret AND resource.labels.secret_id=listro-secret-key" \
  --limit 100 \
  --format json \
  --project=ops-excellence
```

## Support

For issues:
1. Check Cloud Run logs: `gcloud run logs read listro-python-backend --region asia-south1`
2. Verify IAM roles: `gcloud projects get-iam-policy ops-excellence`
3. Test Secret Manager access: `gcloud secrets versions access latest --secret="listro-secret-key" --project=ops-excellence`
4. Test Gemini API: Use `/api/health` endpoint
5. Review this documentation

## Migration Complete ✅

All direct Gemini API key usage has been removed. The system now uses:
- Google Cloud Secret Manager for credential storage
- Service Account authentication for Gemini API
- OAuth2 credentials instead of API keys
- IAM-based access control
- Production-ready Cloud Run deployment
