# Listro v3 - Production Deployment Guide

## Overview
Complete deployment guide for Listro v3 to Google Cloud Run with Secret Manager authentication.

**Key Change:** No API keys required - uses Secret Manager for Gemini authentication.

## Prerequisites

### Service Account Details
- **Service Account:** `listro-sa@ops-excellence.iam.gserviceaccount.com`
- **Project ID:** `ops-excellence`
- **Project Number:** `648176215467`
- **Region:** `asia-south1`
- **Key File:** `/home/ashutoshsingh/ops-excellence-sa-key.json`

### Required Permissions
Ensure service account has:
- `roles/run.admin` - Deploy Cloud Run services
- `roles/artifactregistry.writer` - Push Docker images
- `roles/secretmanager.secretAccessor` - Access Secret Manager
- `roles/iam.serviceAccountUser` - Use service account

### Secret Manager Setup
Ensure service account JSON is uploaded to Secret Manager:
```bash
# Verify secret exists
gcloud secrets versions access latest \
  --secret="listro-secret-key" \
  --project=ops-excellence
```

## Step 1: Authentication Setup

**Important:** The key file is ONLY used for `gcloud` CLI authentication. Cloud Run services will use ADC (Application Default Credentials) and fetch Gemini credentials from Secret Manager automatically.

```bash
# Activate service account (for gcloud CLI operations only)
gcloud auth activate-service-account listro-sa@ops-excellence.iam.gserviceaccount.com \
  --key-file=/home/ashutoshsingh/ops-excellence-sa-key.json

# Set project
gcloud config set project ops-excellence

# Verify authentication
gcloud auth list
gcloud config get-value project

# Configure Docker for Artifact Registry
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

**Note:** Do NOT set `GOOGLE_APPLICATION_CREDENTIALS` environment variable. Cloud Run will use its own service account identity to access Secret Manager.

## Step 2: Set Environment Variables

```bash
# Project configuration
PROJECT_ID="ops-excellence"
PROJECT_NUMBER="648176215467"
REGION="asia-south1"
REPO="asia-south1-docker.pkg.dev/$PROJECT_ID/listro-backend"

# Service URLs (will be generated)
FRONTEND_URL="https://listrov3-frontend-$PROJECT_NUMBER.$REGION.run.app"
NODE_URL="https://listrov3-node-api-$PROJECT_NUMBER.$REGION.run.app"
PYTHON_URL="https://listrov3-python-api-$PROJECT_NUMBER.$REGION.run.app"

echo "🔧 Deployment Configuration:"
echo "📦 Project ID: $PROJECT_ID"
echo "🔢 Project Number: $PROJECT_NUMBER"
echo "🌍 Region: $REGION"
echo "📦 Repository: $REPO"
echo ""
echo "🌐 Service URLs:"
echo "  Frontend: $FRONTEND_URL"
echo "  Node API: $NODE_URL"
echo "  Python API: $PYTHON_URL"
```

## Step 3: Build and Push Docker Images

### 3.1 Build Frontend
```bash
echo "🚀 Building frontend..."
docker build -t $REPO/listro-frontend:v3 \
  --build-arg VITE_NODE_BACKEND_URL=$NODE_URL \
  --build-arg VITE_PYTHON_BACKEND_URL=$PYTHON_URL \
  -f Dockerfile .

docker push $REPO/listro-frontend:v3
echo "✅ Frontend pushed: $REPO/listro-frontend:v3"
```

### 3.2 Build Node.js Backend
```bash
echo "🚀 Building Node.js backend..."
cd backend
docker build -t $REPO/listro-node-api:v3 -f Dockerfile.node .
docker push $REPO/listro-node-api:v3
echo "✅ Node.js backend pushed: $REPO/listro-node-api:v3"
```

### 3.3 Build Python Backend
```bash
echo "🚀 Building Python backend..."
docker build -t $REPO/listro-python-api:v3 -f Dockerfile.python .
docker push $REPO/listro-python-api:v3
echo "✅ Python backend pushed: $REPO/listro-python-api:v3"
cd ..
```

## Step 4: Deploy to Cloud Run

### 4.1 Deploy Frontend
```bash
echo "🚀 Deploying frontend..."
gcloud run deploy listrov3-frontend \
  --image=$REPO/listro-frontend:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=80 \
  --labels=app=listro,component=frontend,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
  --min-instances=0 \
  --max-instances=3 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=300s

echo "✅ Frontend deployed: $FRONTEND_URL"
```

### 4.2 Deploy Node.js Backend
```bash
echo "🚀 Deploying Node.js backend..."
gcloud run deploy listrov3-node-api \
  --image=$REPO/listro-node-api:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data" \
  --labels=app=listro,component=node-api,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
  --min-instances=0 \
  --max-instances=5 \
  --cpu=1 \
  --memory=2Gi \
  --timeout=300s \
  --concurrency=5

echo "✅ Node.js backend deployed: $NODE_URL"
```

### 4.3 Deploy Python Backend (✅ NO API KEY REQUIRED)
```bash
echo "🚀 Deploying Python backend with Secret Manager authentication..."
gcloud run deploy listrov3-python-api \
  --image=$REPO/listro-python-api:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data,_LEAD_SPREADSHEET_ID=1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4,_USER_SPREADSHEET_ID=1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto" \
  --labels=app=listro,component=python-api,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
  --min-instances=0 \
  --max-instances=5 \
  --cpu=1 \
  --memory=2Gi \
  --timeout=300s \
  --concurrency=5

echo "✅ Python backend deployed: $PYTHON_URL"
echo "🔐 Authentication: Secret Manager (no API keys)"
```

## Step 5: Verify Deployment

### 5.1 Check Service Status
```bash
echo "📊 Checking service status..."
gcloud run services list --region=$REGION --filter="metadata.name:listrov3"
```

### 5.2 Verify Python Backend (Secret Manager)
```bash
echo "🧪 Testing Python backend health check..."
curl -s "$PYTHON_URL/api/health" | jq .

# Expected response should show:
# {
#   "status": "healthy",
#   "services": {
#     "gemini_text": "gemini-2.5-flash",
#     "gemini_image": "gemini-2.5-flash-image-preview",
#     "authentication": "via_secret_manager"
#   }
# }
```

### 5.3 Check Logs
```bash
echo "📋 Checking Python backend logs..."
gcloud run logs read listrov3-python-api --region=$REGION --limit=50

# Look for these success messages:
# ✅ Secret retrieved successfully from Secret Manager
# ✅ Credentials created successfully
# ✅ Gemini API configured successfully
# ✅ Gemini models initialized successfully via Secret Manager
# 🔐 Authentication: Service Account + Secret Manager
```

### 5.4 Test Endpoints
```bash
echo "🧪 Testing critical endpoints..."

# Test health check
curl -s "$PYTHON_URL/api/health" | jq .

# Test text generation (requires payload)
curl -X POST "$PYTHON_URL/api/generate-title-description" \
  -H "Content-Type: application/json" \
  -d '{
    "subcategory": "T-Shirt",
    "type": "title",
    "material": "Cotton",
    "color": "Blue"
  }' | jq .
```

## Key Differences from Previous Deployment

### ❌ REMOVED from Python Backend Environment Variables:
- `GOOGLE_API_KEY=$GEMINI_API_KEY` (no longer needed)
- `GEMINI_API_KEY=...` (no longer needed)

### ✅ ADDED/CHANGED:
- Secret Manager integration (automatic via code)
- Service account authentication (automatic via Cloud Run)
- No manual API key management required

## Troubleshooting

### Issue: "Secret not found"
```bash
# Verify secret exists
gcloud secrets versions access latest --secret="listro-secret-key" --project=ops-excellence

# If not found, upload it
gcloud secrets versions add listro-secret-key \
  --data-file=/path/to/service-account.json \
  --project=ops-excellence
```

### Issue: "Permission denied"
```bash
# Grant Secret Manager access to Cloud Run SA
gcloud secrets add-iam-policy-binding listro-secret-key \
  --member=serviceAccount:listro-sa@ops-excellence.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=ops-excellence
```

### Issue: "Gemini API access denied"
```bash
# Enable API
gcloud services enable generativelanguage.googleapis.com --project=ops-excellence

# Grant permissions to service account in the secret
# (This requires updating the service account JSON in Secret Manager)
```

### Issue: Build fails
```bash
# Clear Docker cache and rebuild
docker system prune -a -f
docker build --no-cache -t $REPO/listro-python-api:v3 -f backend/Dockerfile.python backend/
```

## Rollback Procedure

### List Previous Revisions
```bash
gcloud run revisions list --service=listrov3-python-api --region=$REGION
```

### Rollback to Previous Revision
```bash
# Get previous revision name from list above
PREVIOUS_REVISION="listrov3-python-api-00123-abc"

gcloud run services update-traffic listrov3-python-api \
  --region=$REGION \
  --to-revisions=$PREVIOUS_REVISION=100
```

## Monitoring

### View Real-time Logs
```bash
# Frontend logs
gcloud run logs tail listrov3-frontend --region=$REGION

# Node backend logs
gcloud run logs tail listrov3-node-api --region=$REGION

# Python backend logs
gcloud run logs tail listrov3-python-api --region=$REGION
```

### Check Secret Manager Access Logs
```bash
gcloud logging read "resource.type=secret_manager_secret AND resource.labels.secret_id=listro-secret-key" \
  --limit 50 \
  --format json \
  --project=ops-excellence
```

### Monitor Service Metrics
```bash
# CPU and Memory usage
gcloud monitoring dashboards list --project=ops-excellence

# Or use Cloud Console:
# https://console.cloud.google.com/run?project=ops-excellence
```

## Cost Optimization

### Current Configuration
- **Frontend:** 0-3 instances, 512Mi RAM (minimal cost)
- **Node Backend:** 0-5 instances, 2Gi RAM (scales with demand)
- **Python Backend:** 0-5 instances, 2Gi RAM (scales with demand)
- **Min instances:** 0 (pay only when active)

### To Reduce Cold Starts (Optional)
```bash
# Keep 1 instance always warm (increases cost)
gcloud run services update listrov3-python-api \
  --region=$REGION \
  --min-instances=1
```

## Security Best Practices

✅ **Implemented:**
- No API keys in environment variables
- Service account authentication
- Secret Manager for credential storage
- IAM-based access control
- Minimal privileges principle

✅ **Recommended:**
- Regularly rotate service account keys
- Monitor Secret Manager access logs
- Set up alerting for unusual access patterns
- Review IAM permissions quarterly

## Support

- **Documentation:** `SECRET_MANAGER_MIGRATION.md`
- **Migration Guide:** `MIGRATION_CHECKLIST.md`
- **Quick Reference:** `QUICK_REFERENCE.md`
- **Validation:** `VALIDATION_REPORT.md`

---

**Last Updated:** December 27, 2025  
**Deployment Method:** Cloud Run with Secret Manager Authentication  
**Status:** Production Ready ✅
