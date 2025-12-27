# Secret Manager Migration Checklist

## Pre-Migration ✅
- [x] Backup current `.env` files with API keys (stored securely)
- [x] Verify service account JSON is available
- [x] Ensure GCP project permissions
- [x] Document current setup

## Secret Manager Setup
- [ ] Verify service account exists in GCP Console
- [ ] Create secret in Secret Manager: `listro-secret-key`
  ```bash
  gcloud secrets create listro-secret-key \
    --project=ops-excellence \
    --replication-policy="automatic"
  ```
- [ ] Upload service account JSON to secret
  ```bash
  gcloud secrets versions add listro-secret-key \
    --project=ops-excellence \
    --data-file=/path/to/service-account.json
  ```
- [ ] Verify secret is accessible via CLI
  ```bash
  gcloud secrets versions access latest \
    --secret="listro-secret-key" \
    --project=ops-excellence
  ```

## IAM Configuration
- [ ] Grant Cloud Run SA `secretmanager.secretAccessor` role
  ```bash
  gcloud projects add-iam-policy-binding ops-excellence \
    --member=serviceAccount:648176215467-compute@developer.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
  ```
- [ ] Grant Gemini SA `aiplatform.user` role
  ```bash
  gcloud projects add-iam-policy-binding ops-excellence \
    --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
    --role=roles/aiplatform.user
  ```
- [ ] Grant Gemini SA `storage.objectCreator` role
  ```bash
  gcloud projects add-iam-policy-binding ops-excellence \
    --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
    --role=roles/storage.objectCreator
  ```
- [ ] Grant Gemini SA `storage.objectViewer` role
  ```bash
  gcloud projects add-iam-policy-binding ops-excellence \
    --member=serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com \
    --role=roles/storage.objectViewer
  ```
- [ ] Verify roles with `gcloud projects get-iam-policy ops-excellence`

## Code Deployment ✅
- [x] Created `backend/secret_manager.py`
- [x] Updated `backend/python-server.py` with new imports
- [x] Updated `backend/python-server-cloudrun.py` with new imports
- [x] Updated `backend/amz_metadata_scraper.py` with new imports
- [x] Updated `backend/pnd.py` with new imports
- [x] Updated `backend/requirements.txt` with new dependencies
- [x] Updated `backend/Dockerfile.python` to copy secret_manager.py
- [x] Removed all GOOGLE_API_KEY references
- [x] Removed all GEMINI_API_KEY references

## Environment Variables ✅
- [x] Updated `.env.production` - removed API keys
- [x] Updated `.env.python.production` - removed API keys
- [x] Set `GCP_PROJECT_ID=ops-excellence`
- [x] Set `FRONTEND_ORIGIN` correctly
- [x] Set `FLASK_ENV=production` for Cloud Run
- [x] Set `ENV=production` for Cloud Run

## Local Testing
- [ ] Run `gcloud auth application-default login`
- [ ] Test locally: `cd backend && python python-server.py`
- [ ] Verify startup logs show Secret Manager initialization
- [ ] Test `/api/health` endpoint
- [ ] Test Gemini generation endpoints
  - [ ] `/api/generate-title-description`
  - [ ] `/generate-image`
  - [ ] `/api/generate-keywords`
- [ ] Test metadata scraping: `/api/scrape-metadata-from-asin`
- [ ] Check logs for secret retrieval messages

## Cloud Run Deployment
- [ ] Build Docker image
  ```bash
  cd backend
  gcloud builds submit --tag gcr.io/ops-excellence/listro-python-backend
  ```
- [ ] Deploy to Cloud Run
  ```bash
  gcloud run deploy listro-python-backend \
    --image gcr.io/ops-excellence/listro-python-backend \
    --platform managed \
    --region asia-south1 \
    --allow-unauthenticated \
    --memory 2Gi \
    --timeout 3600 \
    --set-env-vars FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=ops-excellence,FRONTEND_ORIGIN=https://listrov3-frontend-648176215467.asia-south1.run.app
  ```
- [ ] Check deployment logs
  ```bash
  gcloud run logs read listro-python-backend --region asia-south1 --limit 50
  ```
- [ ] Test deployed `/api/health` endpoint
- [ ] Monitor Secret Manager access logs
- [ ] Test image generation on deployed service
- [ ] Test metadata scraping on deployed service
- [ ] Test all critical endpoints

## Verification Tests
- [ ] All Gemini endpoints working
  - [ ] Text generation (titles/descriptions)
  - [ ] Image generation
  - [ ] Keywords generation
  - [ ] Metadata scraping
- [ ] No API keys in code (grep check)
  ```bash
  grep -r "GEMINI_API_KEY\|GOOGLE_API_KEY" backend/*.py
  ```
- [ ] No API keys in environment (Cloud Run config check)
- [ ] Logs show Secret Manager auth
- [ ] Health check shows all services available
- [ ] Response times acceptable
- [ ] Error handling works correctly

## Cleanup
- [ ] Remove old `.env` files with API keys from repository
  ```bash
  git rm backend/.env
  rm backend/.env.local
  rm backend/.env.development
  ```
- [ ] Remove `GOOGLE_API_KEY` from Cloud Run secrets (if any)
- [ ] Document the migration in wiki/docs
- [ ] Archive old API keys (secure location, not in repo)
- [ ] Disable/delete old service accounts if any
- [ ] Update team documentation
- [ ] Notify team of migration

## Rollback Plan (if needed)
- [ ] Keep old Docker images
  ```bash
  gcloud container images list --repository=gcr.io/ops-excellence
  ```
- [ ] Document old Cloud Run deployment command
- [ ] Keep `.env` with API key in secure location (encrypted backup)
- [ ] Test rollback process in staging
- [ ] Document rollback steps clearly

## Post-Migration Monitoring (48 hours)
- [ ] Monitor error rates in Cloud Run
- [ ] Check Secret Manager access patterns
- [ ] Verify billing/cost impact
- [ ] Monitor Gemini API quota usage
- [ ] Check application performance metrics
- [ ] Review security audit logs
- [ ] Collect user feedback

## Success Criteria
- [ ] ✅ No API keys in code or environment
- [ ] ✅ All endpoints functional
- [ ] ✅ Secret Manager integration working
- [ ] ✅ IAM permissions correct
- [ ] ✅ Audit logging enabled
- [ ] ✅ Documentation updated
- [ ] ✅ Team trained on new system
- [ ] ✅ Monitoring in place

## Commands Reference

### Secret Management
```bash
# List secrets
gcloud secrets list --project=ops-excellence

# View secret versions
gcloud secrets versions list listro-secret-key --project=ops-excellence

# Access secret
gcloud secrets versions access latest --secret="listro-secret-key" --project=ops-excellence

# Update secret
gcloud secrets versions add listro-secret-key --data-file=new-sa.json --project=ops-excellence

# Delete old version (be careful!)
gcloud secrets versions destroy VERSION_NUMBER --secret="listro-secret-key" --project=ops-excellence
```

### IAM Management
```bash
# List IAM policies
gcloud projects get-iam-policy ops-excellence

# Check specific member permissions
gcloud projects get-iam-policy ops-excellence \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:listro-gemini@ops-excellence.iam.gserviceaccount.com"

# Add permission
gcloud projects add-iam-policy-binding ops-excellence \
  --member=serviceAccount:EMAIL \
  --role=ROLE

# Remove permission
gcloud projects remove-iam-policy-binding ops-excellence \
  --member=serviceAccount:EMAIL \
  --role=ROLE
```

### Cloud Run Management
```bash
# List services
gcloud run services list --region=asia-south1

# Describe service
gcloud run services describe listro-python-backend --region=asia-south1

# View logs
gcloud run logs read listro-python-backend --region=asia-south1 --limit=100

# Update environment variables
gcloud run services update listro-python-backend \
  --region=asia-south1 \
  --set-env-vars KEY=VALUE

# Rollback to previous revision
gcloud run services update-traffic listro-python-backend \
  --region=asia-south1 \
  --to-revisions=REVISION=100
```

### Testing Commands
```bash
# Local test with ADC
gcloud auth application-default login
python backend/python-server.py

# Test health endpoint
curl https://YOUR-CLOUD-RUN-URL/api/health | jq .

# Test Gemini endpoint
curl -X POST https://YOUR-CLOUD-RUN-URL/api/generate-title-description \
  -H "Content-Type: application/json" \
  -d '{"subcategory":"T-Shirt","type":"title","material":"Cotton","color":"Blue"}' | jq .
```

## Notes
- Project Number: `648176215467`
- Project ID: `ops-excellence`
- Secret Name: `listro-secret-key`
- Region: `asia-south1`
- Service Account: `listro-gemini@ops-excellence.iam.gserviceaccount.com`
- Cloud Run Service: `listro-python-backend`

## Migration Status: ✅ CODE COMPLETE - READY FOR DEPLOYMENT
