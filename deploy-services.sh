#!/bin/bash

# Set variables
PROJECT_ID="ops-excellence"
PROJECT_NUMBER="648176215467"
REGION="asia-south1"
REPO="asia-south1-docker.pkg.dev/$PROJECT_ID/listro-backend"
GEMINI_API_KEY="AIzaSyBkisgDPBv9NonKfBDJjgWicjpPsGKW2VM"

# Set URLs
FRONTEND_URL="https://listrov3-frontend-$PROJECT_NUMBER.$REGION.run.app"
NODE_URL="https://listrov3-node-api-$PROJECT_NUMBER.$REGION.run.app"
PYTHON_URL="https://listrov3-python-api-$PROJECT_NUMBER.$REGION.run.app"

echo "════════════════════════════════════════════════════════════"
echo "DEPLOY PHASE - Deploying to Cloud Run"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Service URLs:"
echo "  Frontend: $FRONTEND_URL"
echo "  Node API: $NODE_URL"
echo "  Python API: $PYTHON_URL"
echo ""

# 1. Deploy Frontend
echo "🚀 Deploying frontend..."
gcloud run deploy listrov3-frontend \
  --image=$REPO/listro-frontend:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=8080 \
  --labels=app=listro,component=frontend,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
  --min-instances=0 \
  --max-instances=5 \
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

# 2. Deploy Node.js Backend
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

# 3. Deploy Python Backend
echo "🚀 Deploying Python backend..."
gcloud run deploy listrov3-python-api \
  --image=$REPO/listro-python-api:v3 \
  --platform=managed \
  --region=$REGION \
  --service-account=listro-sa@ops-excellence.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_API_KEY=$GEMINI_API_KEY,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data,_LEAD_SPREADSHEET_ID=1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4,_USER_SPREADSHEET_ID=1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto" \
  --labels=app=listro,component=python-api,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
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

