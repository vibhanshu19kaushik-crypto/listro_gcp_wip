# Secret Manager Refactoring - Quick Reference

## What Changed

### ❌ BEFORE (API Key Method)
```python
# Old way - API key in environment
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
text_model = genai.GenerativeModel("gemini-2.5-flash")
```

### ✅ AFTER (Secret Manager Method)
```python
# New way - Service Account from Secret Manager
from secret_manager import get_gemini_models
credentials, text_model, image_model = get_gemini_models()
```

## Files Modified

| File | Changes |
|------|---------|
| `backend/secret_manager.py` | ✅ NEW - Handles all credential management |
| `backend/python-server.py` | ✅ Removed API key, uses secret_manager |
| `backend/python-server-cloudrun.py` | ✅ Removed API key, uses secret_manager |
| `backend/amz_metadata_scraper.py` | ✅ Removed API key, uses secret_manager |
| `backend/pnd.py` | ✅ Removed API key, uses secret_manager |
| `backend/Dockerfile.python` | ✅ Copies secret_manager.py |
| `backend/requirements.txt` | ✅ Added google-cloud-secret-manager |
| `backend/.env.production` | ❌ Removed GEMINI_API_KEY |
| `backend/.env.python.production` | ❌ Removed GOOGLE_API_KEY, GEMINI_API_KEY |

## Architecture

```
Application → secret_manager.py → Secret Manager → Service Account JSON → Gemini API
```

## Secret Manager Path
```
projects/648176215467/secrets/listro-secret-key/versions/latest
```

## Quick Deploy Commands

### 1. Upload Service Account to Secret Manager
```bash
# Create secret (first time only)
gcloud secrets create listro-secret-key \
  --project=ops-excellence \
  --replication-policy="automatic"

# Upload SA JSON
gcloud secrets versions add listro-secret-key \
  --project=ops-excellence \
  --data-file=/path/to/service-account.json
```

### 2. Grant Permissions
```bash
# Cloud Run access to Secret Manager
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:648176215467-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Service Account access to Gemini
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
  --role=roles/aiplatform.user
```

### 3. Deploy to Cloud Run
```bash
gcloud run deploy listro-python-backend \
  --source ./backend \
  --dockerfile Dockerfile.python \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 3600 \
  --set-env-vars FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=ops-excellence
```

### 4. Verify Deployment
```bash
# Check logs
gcloud run logs read listro-python-backend --region asia-south1 --limit 20

# Test health endpoint
curl https://YOUR-URL/api/health
```

## Expected Startup Logs
```
🔐 Retrieving secret 'listro-secret-key' from Secret Manager...
✅ Secret retrieved successfully from Secret Manager
🔑 Creating credentials from service account...
✅ Credentials created successfully
🤖 Configuring Gemini API...
✅ Gemini API configured successfully
✅ Gemini text and image models initialized
✅ Gemini models initialized successfully via Secret Manager
   - Text model: gemini-2.5-flash
   - Image model: gemini-2.5-flash-image-preview
🚀 Starting Flask on 0.0.0.0:8080, debug=False
🌐 Frontend origin: https://listrov3-frontend-648176215467.asia-south1.run.app
🤖 Gemini models: ✅ Initialized
🔐 Authentication: Service Account + Secret Manager
```

## Troubleshooting

### Issue: "Secret not found"
```bash
# Check if secret exists
gcloud secrets list --project=ops-excellence | grep listro-secret-key

# If missing, create it
gcloud secrets create listro-secret-key --project=ops-excellence --replication-policy="automatic"
gcloud secrets versions add listro-secret-key --data-file=sa.json --project=ops-excellence
```

### Issue: "Permission denied"
```bash
# Grant Secret Manager access
gcloud secrets add-iam-policy-binding listro-secret-key \
  --member=serviceAccount:648176215467-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=ops-excellence
```

### Issue: "Gemini API access denied"
```bash
# Enable API
gcloud services enable generativelanguage.googleapis.com --project=ops-excellence

# Grant permissions
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
  --role=roles/aiplatform.user
```

## Local Testing

```bash
# Setup ADC
gcloud auth application-default login

# Install deps
cd backend
pip install -r requirements.txt

# Run locally
python python-server.py
```

## Security Benefits

✅ **No API keys in code**
✅ **No API keys in environment variables**
✅ **Centralized credential management**
✅ **Automatic audit logging**
✅ **IAM-based access control**
✅ **Credential rotation support**
✅ **Production-ready security**

## Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health` | System health check |
| `/api/generate-title-description` | Gemini text generation |
| `/generate-image` | Gemini image generation |
| `/api/generate-keywords` | Keyword generation |
| `/api/scrape-metadata-from-asin` | Metadata scraping |

## Important Notes

1. **No .env files needed in production** - All config via environment variables
2. **Service Account must be in Secret Manager** - Not as a file
3. **Cloud Run uses ADC automatically** - No manual credential setup
4. **All API calls use OAuth2** - Not API keys
5. **Backward compatible** - Old endpoints still work the same way

## Support

- 📖 Full documentation: `SECRET_MANAGER_MIGRATION.md`
- ✅ Migration checklist: `MIGRATION_CHECKLIST.md`
- 🔧 Code: `backend/secret_manager.py`

## Status: ✅ READY FOR DEPLOYMENT

All code changes complete. Follow MIGRATION_CHECKLIST.md for deployment steps.
