#!/bin/bash
##############################################################################
# Quick Deployment Commands - Listro v3 with Secret Manager
# No API keys, no JSON file paths in environment variables
##############################################################################

# ============================================================================
# STEP 1: Authenticate (gcloud CLI only)
# ============================================================================
gcloud auth activate-service-account listro-sa@ops-excellence.iam.gserviceaccount.com \
  --key-file=/home/ashutoshsingh/ops-excellence-sa-key.json

gcloud config set project ops-excellence
gcloud auth configure-docker asia-south1-docker.pkg.dev

# ============================================================================
# STEP 2: Set Variables
# ============================================================================
PROJECT_ID="ops-excellence"
PROJECT_NUMBER="648176215467"
REGION="asia-south1"
REPO="asia-south1-docker.pkg.dev/$PROJECT_ID/listro-backend"

FRONTEND_URL="https://listrov3-frontend-$PROJECT_NUMBER.$REGION.run.app"
NODE_URL="https://listrov3-node-api-$PROJECT_NUMBER.$REGION.run.app"
PYTHON_URL="https://listrov3-python-api-$PROJECT_NUMBER.$REGION.run.app"

echo "🔧 Deployment Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Frontend: $FRONTEND_URL"
echo "  Node API: $NODE_URL"
echo "  Python API: $PYTHON_URL (Secret Manager auth)"

# ============================================================================
# STEP 3: Build and Push Images
# ============================================================================

# Frontend
echo "🚀 Building frontend..."
docker build -t $REPO/listro-frontend:v3 \
  --build-arg VITE_NODE_BACKEND_URL=$NODE_URL \
  --build-arg VITE_PYTHON_BACKEND_URL=$PYTHON_URL \
  -f Dockerfile .
docker push $REPO/listro-frontend:v3

# Node Backend
echo "🚀 Building Node.js backend..."
cd backend
docker build -t $REPO/listro-node-api:v3 -f Dockerfile.node .
docker push $REPO/listro-node-api:v3

# Python Backend
echo "🚀 Building Python backend (with Secret Manager)..."
docker build -t $REPO/listro-python-api:v3 -f Dockerfile.python .
docker push $REPO/listro-python-api:v3
cd ..

echo "✅ All images built and pushed"

# ============================================================================
# STEP 4: Deploy to Cloud Run
# ============================================================================

# Deploy Frontend
echo "🚀 Deploying frontend..."
gcloud run deploy listrov3-frontend \
  --image=$REPO/listro-frontend:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=80 \
  --labels=app=listro,component=frontend,env=production,version=v3 \
  --min-instances=0 \
  --max-instances=3 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=300s

# Deploy Node Backend
echo "🚀 Deploying Node.js backend..."
gcloud run deploy listrov3-node-api \
  --image=$REPO/listro-node-api:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data" \
  --labels=app=listro,component=node-api,env=production,version=v3 \
  --min-instances=0 \
  --max-instances=5 \
  --cpu=1 \
  --memory=2Gi \
  --timeout=300s \
  --concurrency=5

# Deploy Python Backend (✅ NO API KEY, NO JSON FILE PATH!)
echo "🚀 Deploying Python backend with Secret Manager..."
gcloud run deploy listrov3-python-api \
  --image=$REPO/listro-python-api:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data,_LEAD_SPREADSHEET_ID=1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4,_USER_SPREADSHEET_ID=1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto" \
  --labels=app=listro,component=python-api,env=production,version=v3 \
  --min-instances=0 \
  --max-instances=5 \
  --cpu=1 \
  --memory=2Gi \
  --timeout=300s \
  --concurrency=5

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🌐 Service URLs:"
echo "  Frontend:   $FRONTEND_URL"
echo "  Node API:   $NODE_URL"
echo "  Python API: $PYTHON_URL"
echo ""
echo "🔐 Security Status:"
echo "  ✅ No API keys in environment"
echo "  ✅ No JSON file paths in environment"
echo "  ✅ Secret Manager authentication enabled"
echo "  ✅ Cloud Run uses service account identity"
echo ""
echo "🧪 Test Python backend:"
echo "  curl $PYTHON_URL/api/health | jq ."
echo ""
echo "📋 View logs:"
echo "  gcloud run logs tail listrov3-python-api --region=$REGION"
