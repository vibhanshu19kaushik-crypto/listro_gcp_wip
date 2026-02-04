# Listro v3 Deployment Architecture: SKM & ADC Guide

**Document Version:** 1.0  
**Date:** February 2, 2026  
**Project:** Listro v3 (ops-excellence / GCP)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Architecture](#authentication-architecture)
3. [Service Account Configuration](#service-account-configuration)
4. [Secret Manager (SKM) Implementation](#secret-manager-skm-implementation)
5. [Application Default Credentials (ADC)](#application-default-credentials-adc)
6. [Deployment Flow](#deployment-flow)
7. [Local Development Setup](#local-development-setup)
8. [Production Environment](#production-environment)
9. [Security Features](#security-features)
10. [Troubleshooting](#troubleshooting)
11. [Health Check & Monitoring](#health-check--monitoring)

---

## Overview

Your Listro v3 deployment uses a **zero-API-key architecture** with:

- **SKM (Secret Manager)**: Stores sensitive credentials (Gemini API service account) securely
- **ADC (Application Default Credentials)**: Provides automatic authentication for GCP services
- **Service Account**: `listro-sa@ops-excellence.iam.gserviceaccount.com` handles all authentication
- **Cloud Run**: Serverless deployment with automatic credential injection

### Key Benefits

✅ **No exposed API keys** in code or environment  
✅ **Automatic credential rotation** via Secret Manager  
✅ **Least privilege access** through IAM roles  
✅ **Audit trail** for all credential access  
✅ **Environment parity** (local & production use same flow)

---

## Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  LOCAL DEVELOPMENT                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GOOGLE_APPLICATION_CREDENTIALS env var                     │
│           ↓                                                  │
│  ops-excellence-sa-key.json (local service account key)     │
│           ↓                                                  │
│  ADC Auto-detection                                         │
│           ↓                                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ Services have access to:                     │           │
│  │  • GCS buckets (listro-image-store)          │           │
│  │  • Secret Manager (listro-secret-key)        │           │
│  │  • BigQuery datasets                         │           │
│  │  • Google Sheets (via ADC)                   │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  CLOUD RUN (PRODUCTION)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cloud Run Service Identity (SA workload identity)          │
│           ↓                                                  │
│  listro-sa@ops-excellence.iam.gserviceaccount.com          │
│           ↓                                                  │
│  ADC Auto-detection (no key file needed!)                   │
│           ↓                                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ Container processes automatically use:       │           │
│  │  • Service account identity                  │           │
│  │  • IAM-based access to all services          │           │
│  │  • Workload Identity binding                 │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Account Configuration

### Service Account Details

```
Name:               listro-sa
Email:              listro-sa@ops-excellence.iam.gserviceaccount.com
Project:            ops-excellence
Project Number:     648176215467
```

### IAM Roles Assigned

```
Role                                    Purpose
─────────────────────────────────────────────────────────────
Secret Manager Secret Accessor         Read Gemini credentials from SKM
Storage Object Creator                 Upload images to GCS
Storage Object Viewer                  Read images from GCS
BigQuery Data Editor                   Write to BigQuery tables
BigQuery Read Session User             Read BigQuery data
Service Account User                   Assume service account identity
Service Account Token Creator          Generate access tokens
```

### Key File Location (Local Only)

```
File: /home/ashutoshsingh/ops-excellence-sa-key.json

Format: Service Account Private Key (JSON)
  - key_id: [RSA key ID]
  - private_key: [RSA-2048 private key]
  - client_email: listro-sa@ops-excellence.iam.gserviceaccount.com
  - client_id: [unique ID]
```

**⚠️ Security Note**: This file is ONLY for local development. Cloud Run never uses it.

---

## Secret Manager (SKM) Implementation

### What's Stored

```
Secret Name:        listro-secret-key
Secret Type:        Service Account JSON
Stored Value:       Full Gemini API service account credentials
Versions:           Multiple (rotated automatically)
Access Pattern:     Projects → Secrets → Versions
```

### How It's Retrieved

**Python Backend** (`secret_manager.py`):

```python
# Configuration
PROJECT_NUMBER = "648176215467"
SECRET_NAME = "listro-secret-key"

# Retrieval function
def get_secret_from_manager(project_id: str, secret_id: str, version_id: str = "latest") -> dict:
    """
    Retrieves service account JSON from Secret Manager
    
    Path: projects/{project_id}/secrets/{secret_id}/versions/{version_id}
    """
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})
    secret_data = response.payload.data.decode("UTF-8")
    return json.loads(secret_data)
```

### Initialization Flow

```python
# Step 1: Retrieve Gemini service account from Secret Manager
sa_credentials_dict = get_secret_from_manager(project_number, secret_id)

# Step 2: Create credentials object
credentials = Credentials.from_service_account_info(
    sa_credentials_dict,
    scopes=["https://www.googleapis.com/auth/generative-language"]
)

# Step 3: Configure Gemini API
genai.configure(credentials=credentials)

# Step 4: Initialize models
text_model = genai.GenerativeModel("gemini-2.5-flash")
image_model = genai.GenerativeModel("gemini-2.5-flash-image")
```

### Access Control

- **Who can access**: Only `listro-sa` service account
- **Audit log**: All access logged to Cloud Audit Logs
- **Expiration**: No expiration (manage rotations via versioning)
- **Encryption**: Google-managed encryption at rest

---

## Application Default Credentials (ADC)

### What ADC Does

ADC is a GCP authentication library that automatically discovers credentials in this order:

```
1. Environment Variable → GOOGLE_APPLICATION_CREDENTIALS
   (Points to service account JSON file)
   
2. Service Account Workload Identity
   (Cloud Run's implicit service account)
   
3. Gcloud CLI credentials
   (User's gcloud authentication)
   
4. Compute Engine metadata service
   (If running on GCE, App Engine, etc.)
```

### Local Development (ADC with GOOGLE_APPLICATION_CREDENTIALS)

```bash
# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"

# All subsequent processes use ADC
python3 python-server.py
node server.js

# ADC automatically:
# - Reads the JSON file
# - Extracts service account identity
# - Generates OAuth2 access tokens
# - Handles token refresh
```

### Cloud Run (ADC with Workload Identity)

```bash
# During deployment, Cloud Run is configured with:
gcloud run deploy listrov3-python-api \
    --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
    --image=$REPO/listro-python-api:v3

# Inside the container:
# - No JSON file needed
# - No GOOGLE_APPLICATION_CREDENTIALS set
# - ADC queries metadata service (http://metadata.google.internal)
# - Metadata service verifies workload identity binding
# - Returns temporary access token for listro-sa
```

### ADC Usage in Code

#### Python Backend (Google Sheets)

```python
from google.auth import default

# ADC automatically discovers credentials
creds, project = default(scopes=_SCOPES)

# Create client with ADC credentials
_gc = gspread.authorize(creds)

# Now can access Google Sheets
ws = _gc.open_by_key(_USER_SPREADSHEET_ID).worksheet(_USER_SHEET_NAME)
```

#### Python Backend (Google Cloud Storage)

```python
from google.cloud import storage

# ADC is used implicitly
storage_client = storage.Client()

# Upload to GCS (uses ADC credentials behind the scenes)
bucket = storage_client.bucket(GCS_BUCKET_NAME)
blob = bucket.blob(destination_blob_name)
blob.upload_from_filename(local_file_path)
```

#### Node.js Backend (BigQuery)

```javascript
const { BigQuery } = require('@google-cloud/bigquery');

// ADC is used implicitly by Google Cloud libraries
const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID
});

// BigQuery queries automatically use ADC credentials
const [rows] = await bigquery.query(query);
```

---

## Deployment Flow

### Step 1: Local Development Setup

```bash
# 1. Set ADC for your environment
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/ops-excellence-sa-key.json"

# 2. Install dependencies
cd backend
pip install -r requirements.txt
npm install

# 3. Run servers
PORT=5000 python3 python-server.py
PORT=4000 node server.js

# 4. ADC automatically:
#    - Reads JSON credentials
#    - Accesses Secret Manager
#    - Queries Google Sheets
#    - Uploads to GCS
```

### Step 2: Container Build

```dockerfile
# Dockerfile.python
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy code (NOT copying any JSON credentials!)
COPY python-server.py .
COPY secret_manager.py .

# Cloud Run will set PORT to 8080
ENV PORT=8080
ENV FLASK_ENV=production
ENV ENV=production

EXPOSE 8080
CMD ["python", "python-server.py"]
```

**Key Points**:
- ❌ No credentials.json copied
- ❌ No API keys in environment
- ✅ Code is credential-agnostic

### Step 3: Push to Artifact Registry

```bash
# Build locally
docker build -t asia-south1-docker.pkg.dev/ops-excellence/listro-backend/listro-python-api:v3 \
    -f backend/Dockerfile.python ./backend

# Push to registry
docker push asia-south1-docker.pkg.dev/ops-excellence/listro-backend/listro-python-api:v3
```

### Step 4: Deploy to Cloud Run

```bash
gcloud run deploy listrov3-python-api \
    --image=asia-south1-docker.pkg.dev/ops-excellence/listro-backend/listro-python-api:v3 \
    --platform=managed \
    --region=asia-south1 \
    --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
    --allow-unauthenticated \
    --port=8080 \
    --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=ops-excellence" \
    --max-instances=5 \
    --memory=2Gi \
    --timeout=300s
```

**What Cloud Run Does**:
- Launches container with service account identity
- Container cannot access local filesystem credentials
- Container can only access GCP services via ADC + workload identity
- Metadata service provides temporary access tokens

### Step 5: Container Runtime

```
Cloud Run Container Runtime:

┌────────────────────────────────────┐
│ Container Process                  │
│ (python python-server.py)          │
├────────────────────────────────────┤
│ Calls: google.auth.default()       │
│        (via ADC library)           │
├────────────────────────────────────┤
│ ADC checks (in order):             │
│ 1. GOOGLE_APPLICATION_CREDENTIALS  │
│    → Not set (not local)           │
│ 2. metadata.google.internal        │
│    → Service account identity      │
│    → Workload identity binding     │
├────────────────────────────────────┤
│ Returns: Temporary OAuth2 token    │
│ Valid for: ~1 hour                 │
│ Auto-refreshed: By library         │
└────────────────────────────────────┘

Uses token to access:
├─ Secret Manager (read Gemini credentials)
├─ Google Sheets (read user data)
├─ GCS (upload generated images)
└─ BigQuery (write logs & data)
```

---

## Local Development Setup

### 1. Obtain Service Account Key

```bash
# Download from GCP Console:
# IAM & Admin → Service Accounts → listro-sa
# → Create & download key as JSON

# Save to:
/home/ashutoshsingh/ops-excellence-sa-key.json
```

### 2. Set ADC Environment Variable

```bash
# Add to ~/.bashrc or ~/.zshrc
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"

# Or set in build-and-deploy.sh
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"
```

### 3. Verify ADC is Working

```bash
# Test ADC can read credentials
python3 -c "
from google.auth import default
creds, project = default()
print(f'✅ ADC working! Project: {project}')
print(f'   Service account: {creds.service_account_email}')
"

# Expected output:
# ✅ ADC working! Project: ops-excellence
#    Service account: listro-sa@ops-excellence.iam.gserviceaccount.com
```

### 4. Verify Secret Manager Access

```bash
python3 -c "
from google.cloud import secretmanager
client = secretmanager.SecretManagerServiceClient()
name = 'projects/648176215467/secrets/listro-secret-key/versions/latest'
response = client.access_secret_version(request={'name': name})
print('✅ Secret Manager access working!')
"
```

### 5. Run Services

```bash
# Terminal 1: Python backend
cd backend
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"
PORT=5000 python3 python-server.py

# Terminal 2: Node backend
cd backend
PORT=4000 node server.js

# Terminal 3: Frontend
npm run dev
```

---

## Production Environment

### Deployment Script (`deploy.sh`)

```bash
#!/bin/bash
# Key parts of deployment:

# 1. Authenticate with gcloud (uses local key file)
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"
gcloud auth activate-service-account --key-file=$KEY_FILE

# 2. Build Docker images (no credentials copied to image)
docker build -t $REPO/listro-python-api:v3 -f backend/Dockerfile.python ./backend

# 3. Push to Artifact Registry
docker push $REPO/listro-python-api:v3

# 4. Deploy to Cloud Run (specify service account)
gcloud run deploy listrov3-python-api \
    --image=$REPO/listro-python-api:v3 \
    --service-account=$SERVICE_ACCOUNT \  # ← Workload identity
    --set-env-vars="ENV=production" \
    --region=$REGION
```

### Environment Variables in Cloud Run

```
FRONTEND_ORIGIN    = https://listrov3-frontend-648176215467.asia-south1.run.app
FLASK_ENV          = production
ENV                = production
GCP_PROJECT_ID     = ops-excellence
PORT               = 8080 (set by Cloud Run)
```

**NOT** in environment:
- ❌ API_KEY
- ❌ GOOGLE_APPLICATION_CREDENTIALS
- ❌ GEMINI_API_KEY

### Workload Identity Binding

```bash
# Cloud Run automatically binds service account identity
# No manual binding needed - handled by Cloud Run

# Verify binding:
gcloud run services describe listrov3-python-api \
    --region=asia-south1 \
    --format="value(spec.template.spec.serviceAccountName)"

# Output:
# listro-sa@ops-excellence.iam.gserviceaccount.com
```

---

## Security Features

### 1. Secret Rotation

```
Manual rotation:
  1. Create new version of secret in Secret Manager
  2. Update secret value with new credentials
  3. Existing containers continue using old version
  4. New deployments automatically use new version

Advantages:
  - Zero downtime rotation
  - Gradual migration
  - Audit trail of all versions
```

### 2. Least Privilege Access

```
Service Account Permissions:

✅ Can DO:
  - Read from Secret Manager (only listro-secret-key)
  - Read/Write to GCS bucket (listro-image-store)
  - Read Google Sheets (via domain-wide delegation)
  - Write to BigQuery
  - Generate access tokens

❌ Cannot DO:
  - Create/modify service accounts
  - Delete secrets
  - Modify other projects' resources
  - Access other buckets
```

### 3. Audit Logging

```bash
# View all Secret Manager access:
gcloud logging read \
  'resource.type="secretmanager.googleapis.com" AND 
   resource.labels.secret_id="listro-secret-key"' \
  --limit=50

# View Cloud Run deployments:
gcloud logging read \
  'resource.type="cloud_run_revision" AND 
   resource.labels.service_name="listrov3-python-api"' \
  --limit=50
```

### 4. No Credentials in Code/Images

```
✅ Good practices implemented:
  - .gitignore excludes *.json credentials
  - Docker images contain zero credentials
  - Environment variables contain no secrets
  - API keys never logged or printed
  - Credentials managed externally (ADC + SKM)

Result: Images are safe to publish to public registries
```

---

## Troubleshooting

### Issue 1: "ADC not available in Cloud Run"

**Symptom**:
```
ERROR: Could not load credentials
google.auth.exceptions.DefaultCredentialsError
```

**Solution**:
```bash
# 1. Verify service account is specified:
gcloud run services describe listrov3-python-api \
    --region=asia-south1 \
    --format="value(spec.template.spec.serviceAccountName)"

# 2. If missing, redeploy with correct service account:
gcloud run deploy listrov3-python-api \
    --image=$IMAGE \
    --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com
```

### Issue 2: "Secret Manager: Permission denied"

**Symptom**:
```
PermissionError: caller does not have 'secretmanager.secretVersions.access'
```

**Solution**:
```bash
# 1. Verify IAM role on service account:
gcloud projects get-iam-policy ops-excellence \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:listro-sa@*"

# 2. If missing, add role:
gcloud projects add-iam-policy-binding ops-excellence \
    --member=serviceAccount:listro-sa@ops-excellence.iam.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
```

### Issue 3: "GCS: Permission denied for bucket"

**Symptom**:
```
GoogleCloudError: 403 Forbidden: User does not have storage.objects.create access
```

**Solution**:
```bash
# 1. Verify bucket policy:
gsutil iam ch \
    serviceAccount:listro-sa@ops-excellence.iam.gserviceaccount.com:objectCreator \
    gs://listro-image-store

# 2. Or add IAM role:
gcloud projects add-iam-policy-binding ops-excellence \
    --member=serviceAccount:listro-sa@ops-excellence.iam.gserviceaccount.com \
    --role=roles/storage.objectCreator
```

### Issue 4: "Local development: GOOGLE_APPLICATION_CREDENTIALS not set"

**Symptom**:
```
Could not initialize Google Sheets client with ADC
```

**Solution**:
```bash
# 1. Set environment variable:
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"

# 2. Verify it's set:
echo $GOOGLE_APPLICATION_CREDENTIALS

# 3. Run services:
PORT=5000 python3 python-server.py
```

### Issue 5: "Fallback to credentials.json - file not found"

**Symptom**:
```
⚠️  credentials.json not found and ADC not available
```

**Solution**:
```bash
# Option A: Use GOOGLE_APPLICATION_CREDENTIALS
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

# Option B: Place credentials.json in backend directory
cp /path/to/ops-excellence-sa-key.json backend/credentials.json

# Option C: Ensure ADC finds local key
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"
```

---

## Health Check & Monitoring

### Health Check Endpoint

```bash
# Test Python backend health
curl https://listrov3-python-api-648176215467.asia-south1.run.app/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-02-02 10:30:45",
  "services": {
    "flask": "running",
    "gcs_client": "initialized",
    "google_sheets": "connected",
    "gemini_models": "loaded",
    "authentication": "via_secret_manager"
  }
}
```

### Monitoring ADC/SKM Usage

```bash
# View recent ADC token generations
gcloud logging read \
  'resource.type="cloud_run_revision" AND 
   jsonPayload.event="token_request"' \
  --limit=20

# View Secret Manager access
gcloud logging read \
  'protoPayload.methodName="google.cloud.secretmanager.v1.SecretManagerService.AccessSecretVersion"' \
  --limit=20

# View GCS uploads
gcloud logging read \
  'resource.type="gcs_bucket" AND 
   protoPayload.methodName="storage.objects.create"' \
  --limit=20
```

### Key Metrics

```
Monitor these via Cloud Monitoring:

1. Secret Manager:
   - secretmanager.googleapis.com/access_count
   - secretmanager.googleapis.com/access_latency_ms

2. Cloud Run:
   - run.googleapis.com/request_count
   - run.googleapis.com/request_latencies
   - run.googleapis.com/execution_times

3. GCS:
   - storage.googleapis.com/storage_total_bytes
   - storage.googleapis.com/network.received_bytes

4. Custom (from application logs):
   - Gemini API calls
   - Google Sheets queries
   - Image generation time
```

---

## Reference Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    Listro v3 Architecture                      │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     GCP Project                              │
│                 (ops-excellence)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Service Account                            │    │
│  │  listro-sa@ops-excellence.iam.gserviceaccount.com │    │
│  │                                                    │    │
│  │  Roles:                                           │    │
│  │  • Secret Manager Secret Accessor                │    │
│  │  • Storage Object Creator/Viewer                 │    │
│  │  • BigQuery Data Editor                          │    │
│  │  • Service Account User                          │    │
│  └────────────────────────────────────────────────────┘    │
│         ↓              ↓              ↓                     │
│    ┌─────────┐  ┌────────────┐  ┌─────────────┐            │
│    │   SKM   │  │    GCS     │  │   BigQuery  │            │
│    │         │  │            │  │             │            │
│    │listro-  │  │listro-image│  │  Logs &     │            │
│    │secret-  │  │-store      │  │  Analytics  │            │
│    │key      │  │            │  │             │            │
│    └─────────┘  └─────────────┘  └─────────────┘            │
│         ↑              ↑              ↑                     │
│  ┌──────────────┐  ┌──────────────────┐                    │
│  │  Cloud Run   │  │  Local Dev       │                    │
│  │  (Production)│  │  (Development)   │                    │
│  │              │  │                  │                    │
│  │ ┌──────────┐ │  │ ┌──────────────┐ │                    │
│  │ │ Frontend │ │  │ │ Frontend Dev │ │                    │
│  │ └──────────┘ │  │ └──────────────┘ │                    │
│  │              │  │                  │                    │
│  │ ┌──────────┐ │  │ ┌──────────────┐ │                    │
│  │ │  Python  │ │  │ │  Python Dev  │ │                    │
│  │ │  API     │ │  │ │  API         │ │                    │
│  │ │(ADC via  │ │  │ │(ADC via      │ │                    │
│  │ │workload  │ │  │ │GOOGLE_APP_   │ │                    │
│  │ │identity) │ │  │ │CREDENTIALS)  │ │                    │
│  │ └──────────┘ │  │ └──────────────┘ │                    │
│  │              │  │                  │                    │
│  │ ┌──────────┐ │  │ ┌──────────────┐ │                    │
│  │ │  Node    │ │  │ │  Node Dev    │ │                    │
│  │ │  API     │ │  │ │  API         │ │                    │
│  │ │(ADC via  │ │  │ │(ADC via      │ │                    │
│  │ │workload  │ │  │ │GOOGLE_APP_   │ │                    │
│  │ │identity) │ │  │ │CREDENTIALS)  │ │                    │
│  │ └──────────┘ │  │ └──────────────┘ │                    │
│  └──────────────┘  └──────────────────┘                    │
│                                                              │
│  External APIs:                                             │
│  • Google Sheets (Google Workspace API)                    │
│  • Gemini (Google AI API)                                  │
│  • Chrome/Chromium (for scraping)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary Checklist

### ✅ Deployment Checklist

- [ ] Service account `listro-sa` created with correct IAM roles
- [ ] Secret `listro-secret-key` created in Secret Manager
- [ ] Local: `GOOGLE_APPLICATION_CREDENTIALS` environment variable set
- [ ] Local: Service account key file has read permissions
- [ ] Cloud Run services configured with `listro-sa` as service account
- [ ] Dockerfile images do NOT contain any credentials
- [ ] Artifact Registry images pushed successfully
- [ ] Health check endpoints returning `authentication: via_secret_manager`
- [ ] GCS uploads working (images appearing in bucket)
- [ ] Google Sheets queries working (reading user data)
- [ ] Gemini API calls working (generating images)

### ✅ Security Checklist

- [ ] API keys NOT in environment variables
- [ ] Credentials NOT in Docker images
- [ ] Credentials NOT in Git repository (.gitignore verified)
- [ ] Secret Manager access logged and auditable
- [ ] Service account has minimal required permissions
- [ ] GOOGLE_APPLICATION_CREDENTIALS points to secure location
- [ ] Service account key file has restricted file permissions (600)
- [ ] No local JSON files in production containers

### ✅ Monitoring Checklist

- [ ] Cloud Logging shows successful health checks
- [ ] Secret Manager access logs visible
- [ ] ADC token generation metrics in Cloud Monitoring
- [ ] No authentication errors in application logs
- [ ] GCS uploads logged and tracked
- [ ] BigQuery writes completing successfully

---

## Quick Reference Commands

```bash
# Local Development
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"
PORT=5000 python3 backend/python-server.py

# Verify ADC
gcloud auth application-default print-access-token

# Test Secret Manager
gcloud secrets versions access latest --secret="listro-secret-key"

# Deploy to Cloud Run
./deploy.sh

# View Cloud Run logs
gcloud run logs read listrov3-python-api --region=asia-south1 --limit=50

# Check service account
gcloud iam service-accounts describe listro-sa@ops-excellence.iam.gserviceaccount.com

# View IAM bindings
gcloud projects get-iam-policy ops-excellence \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:listro-sa@*"

# Monitor health
curl https://listrov3-python-api-648176215467.asia-south1.run.app/api/health
```

---

## Document Maintenance

**Last Updated:** February 2, 2026  
**Next Review:** As part of quarterly security audit  
**Maintainer:** Ops Excellence Team  
**Questions?** Refer to GCP documentation:
- [Application Default Credentials](https://cloud.google.com/docs/authentication#adc)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
