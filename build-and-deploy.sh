#!/bin/bash

# Set variables
PROJECT_ID="ops-excellence"
PROJECT_NUMBER="648176215467"
REGION="asia-south1"
REPO="asia-south1-docker.pkg.dev/$PROJECT_ID/listro-backend"
VERSION="v4"

# Service names (must match existing deployed services)
FRONTEND_SERVICE="listrov4-frontend"
NODE_SERVICE="listrov4-node-backend"
PYTHON_SERVICE="listrov4-python-backend"

# Export for use in subshells
export GOOGLE_APPLICATION_CREDENTIALS="/home/ashutoshsingh/ops-excellence-sa-key.json"

echo "🔧 Starting deployment with project: $PROJECT_ID"
echo "📦 Repository: $REPO"
echo "🌍 Region: $REGION"
echo ""

# Configure Docker
echo "🔐 Configuring Docker..."
gcloud auth configure-docker asia-south1-docker.pkg.dev --quiet

echo ""
echo "════════════════════════════════════════════════════════════"
echo "BUILD PHASE - Building Docker images"
echo "════════════════════════════════════════════════════════════"
echo ""

# 1. Build and push Frontend
echo "🚀 Building frontend..."
docker build -t $REPO/listrov4-frontend:$VERSION \
  --build-arg VITE_NODE_BACKEND_URL=https://$NODE_SERVICE-$PROJECT_NUMBER.$REGION.run.app \
  --build-arg VITE_PYTHON_BACKEND_URL=https://$PYTHON_SERVICE-$PROJECT_NUMBER.$REGION.run.app \
  -f Dockerfile .

if [ $? -eq 0 ]; then
  echo "✅ Frontend built successfully"
  echo "📤 Pushing frontend to Artifact Registry..."
  docker push $REPO/listrov4-frontend:$VERSION
  echo "✅ Frontend pushed: $REPO/listrov4-frontend:$VERSION"
else
  echo "❌ Frontend build failed"
  exit 1
fi

echo ""

# 2. Build and push Node.js Backend
echo "🚀 Building Node.js backend..."
cd backend
docker build -t $REPO/listrov4-node-api:$VERSION -f Dockerfile.node .

if [ $? -eq 0 ]; then
  echo "✅ Node.js backend built successfully"
  echo "📤 Pushing Node.js backend to Artifact Registry..."
  docker push $REPO/listrov4-node-api:$VERSION
  echo "✅ Node.js backend pushed: $REPO/listrov4-node-api:$VERSION"
else
  echo "❌ Node.js backend build failed"
  cd ..
  exit 1
fi

echo ""

# 3. Build and push Python Backend
echo "🚀 Building Python backend..."
docker build -t $REPO/listrov4-python-api:$VERSION -f Dockerfile.python .

if [ $? -eq 0 ]; then
  echo "✅ Python backend built successfully"
  echo "📤 Pushing Python backend to Artifact Registry..."
  docker push $REPO/listrov4-python-api:$VERSION
  echo "✅ Python backend pushed: $REPO/listrov4-python-api:$VERSION"
else
  echo "❌ Python backend build failed"
  cd ..
  exit 1
fi

cd ..

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ BUILD PHASE COMPLETE - All images built and pushed"
echo "════════════════════════════════════════════════════════════"

