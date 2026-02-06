#!/bin/bash

# Set variables
PROJECT_ID="ops-excellence"
PROJECT_NUMBER="648176215467"
REGION="asia-south1"
REPO="asia-south1-docker.pkg.dev/$PROJECT_ID/listro-backend"
VERSION="v4"
SERVICE_ACCOUNT="listro-sa@ops-excellence.iam.gserviceaccount.com"

# Service names (must match existing deployed services)
FRONTEND_SERVICE="listrov4-frontend"
NODE_SERVICE="listrov4-node-backend"
PYTHON_SERVICE="listrov4-python-backend"

# Set URLs (existing deployed services)
FRONTEND_URL="https://$FRONTEND_SERVICE-$PROJECT_NUMBER.$REGION.run.app"
NODE_URL="https://$NODE_SERVICE-$PROJECT_NUMBER.$REGION.run.app"
PYTHON_URL="https://$PYTHON_SERVICE-$PROJECT_NUMBER.$REGION.run.app"

echo "════════════════════════════════════════════════════════════"
echo "DEPLOY PHASE - Deploying to Cloud Run"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Service URLs:"
echo "  Frontend: $FRONTEND_URL"
echo "  Node API: $NODE_URL"
echo "  Python API: $PYTHON_URL"
echo ""


# 1. Deploy Listrov4 Frontend
echo "🚀 Deploying Listrov4 frontend..."
gcloud run deploy $FRONTEND_SERVICE \
  --image=$REPO/listrov4-frontend:$VERSION \
  --platform=managed \
  --region=$REGION \
  --service-account=$SERVICE_ACCOUNT \
  --allow-unauthenticated \
  --port=8080 \
  --labels=app=listrov4,component=frontend,env=production,version=v4,cost-center=listro-vertex-gemini,team=ops-excellence,deployment=cloud-run,vertex-ai=enabled,gemini-ai=enabled,cloud-run=true,billing-category=ai-services \
  --set-secrets="SKM_SECRET=projects/$PROJECT_NUMBER/secrets/listro-secret-key:latest" \
  --min-instances=0 \
  --max-instances=3 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=300s \
  --quiet

if [ $? -eq 0 ]; then
  echo "✅ Frontend deployed successfully"
else
  echo "❌ Frontend deployment failed"
  exit 1
fi

echo ""


# 2. Deploy Listrov4 Node.js Backend
echo "🚀 Deploying Listrov4 Node.js backend..."
gcloud run deploy $NODE_SERVICE \
  --image=$REPO/listrov4-node-api:$VERSION \
  --platform=managed \
  --region=$REGION \
  --service-account=$SERVICE_ACCOUNT \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data" \
  --labels=app=listrov4,component=node-backend,env=production,version=v4,cost-center=listro-vertex-gemini,team=ops-excellence,deployment=cloud-run,vertex-ai=enabled,gemini-ai=enabled,cloud-run=true,billing-category=ai-services \
  --set-secrets="SKM_SECRET=projects/$PROJECT_NUMBER/secrets/listro-secret-key:latest" \
  --min-instances=0 \
  --max-instances=10 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=300s \
  --concurrency=20 \
  --quiet

if [ $? -eq 0 ]; then
  echo "✅ Node.js backend deployed successfully"
else
  echo "❌ Node.js backend deployment failed"
  exit 1
fi

echo ""


# 3. Deploy Listrov4 Python Backend
echo "🚀 Deploying Listrov4 Python backend (with Selenium, Vertex AI, Gemini)..."
gcloud run deploy $PYTHON_SERVICE \
  --image=$REPO/listrov4-python-api:$VERSION \
  --platform=managed \
  --region=$REGION \
  --service-account=$SERVICE_ACCOUNT \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data,_LEAD_SPREADSHEET_ID=1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4,_USER_SPREADSHEET_ID=1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto,CHROME_BIN=/usr/bin/chromium,CHROMEDRIVER_PATH=/usr/bin/chromedriver" \
  --labels=app=listrov4,component=python-backend,env=production,version=v4,cost-center=listro-vertex-gemini,team=ops-excellence,deployment=cloud-run,vertex-ai=enabled,gemini-ai=enabled,selenium=enabled,cloud-run=true,billing-category=ai-services \
  --set-secrets="SKM_SECRET=projects/$PROJECT_NUMBER/secrets/listro-secret-key:latest" \
  --min-instances=0 \
  --max-instances=10 \
  --cpu=2 \
  --memory=4Gi \
  --timeout=300s \
  --concurrency=10 \
  --quiet

if [ $? -eq 0 ]; then
  echo "✅ Python backend deployed successfully"
else
  echo "❌ Python backend deployment failed"
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ DEPLOY PHASE COMPLETE - All services deployed"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Service URLs:"
echo "  Frontend: $FRONTEND_URL"
echo "  Node API: $NODE_URL"
echo "  Python API: $PYTHON_URL"
echo ""

