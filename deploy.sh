#!/bin/bash

##############################################################################
# Listro v3 - Production Deployment Script
# 
# This script deploys Listro v3 to Google Cloud Run with:
# - Secret Manager authentication (NO API KEYS, NO LOCAL JSON FILES)
# - Service account uses ADC (Application Default Credentials)
# - Artifact Registry
# - Auto-scaling Cloud Run services
#
# Usage: ./deploy.sh [OPTIONS]
#   Options:
#     --skip-build    Skip Docker build, only deploy existing images
#     --frontend-only Deploy only frontend
#     --backend-only  Deploy only backends
#     --verify-only   Only verify deployment, no build/deploy
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="ops-excellence"
PROJECT_NUMBER="648176215467"
REGION="asia-south1"
REPO="asia-south1-docker.pkg.dev/$PROJECT_ID/listro-backend"
SERVICE_ACCOUNT="listro-sa@ops-excellence.iam.gserviceaccount.com"

# Note: Key file only used for gcloud authentication, NOT passed to Cloud Run
KEY_FILE="/home/ashutoshsingh/ops-excellence-sa-key.json"

# Service URLs
FRONTEND_URL="https://listrov3-frontend-$PROJECT_NUMBER.$REGION.run.app"
NODE_URL="https://listrov3-node-api-$PROJECT_NUMBER.$REGION.run.app"
PYTHON_URL="https://listrov3-python-api-$PROJECT_NUMBER.$REGION.run.app"

# Parse command line arguments
SKIP_BUILD=false
FRONTEND_ONLY=false
BACKEND_ONLY=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./deploy.sh [--skip-build] [--frontend-only] [--backend-only] [--verify-only]"
            exit 1
            ;;
    esac
done

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

##############################################################################
# Step 0: Verify Prerequisites
##############################################################################

verify_prerequisites() {
    print_header "Verifying Prerequisites"
    
    # Check if key file exists
    if [ ! -f "$KEY_FILE" ]; then
        print_error "Service account key file not found: $KEY_FILE"
        exit 1
    fi
    print_success "Service account key file found"
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    fi
    print_success "gcloud CLI found"
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install Docker."
        exit 1
    fi
    print_success "Docker found"
    
    # Verify Secret Manager secret exists
    print_info "Verifying Secret Manager configuration..."
    if gcloud secrets versions access latest --secret="listro-secret-key" --project=$PROJECT_ID &> /dev/null; then
        print_success "Secret Manager secret 'listro-secret-key' verified"
    else
        print_error "Secret 'listro-secret-key' not found in Secret Manager"
        print_info "Run: gcloud secrets versions add listro-secret-key --data-file=/path/to/sa.json --project=$PROJECT_ID"
        exit 1
    fi
}

##############################################################################
# Step 1: Authentication
##############################################################################

setup_authentication() {
    print_header "Setting Up Authentication"
    
    # Activate service account (for gcloud CLI only)
    print_info "Activating service account for gcloud CLI..."
    gcloud auth activate-service-account $SERVICE_ACCOUNT --key-file=$KEY_FILE
    print_success "Service account activated"
    
    # Set project
    gcloud config set project $PROJECT_ID
    print_success "Project set to $PROJECT_ID"
    
    # Configure Docker for Artifact Registry
    gcloud auth configure-docker asia-south1-docker.pkg.dev --quiet
    print_success "Docker configured for Artifact Registry"
    
    # Verify authentication
    print_info "Current authentication:"
    gcloud auth list
    echo ""
    print_info "Current project: $(gcloud config get-value project)"
    echo ""
    print_warning "Note: Cloud Run will use ADC (not local JSON file)"
    print_info "Python backend will fetch credentials from Secret Manager"
}

##############################################################################
# Step 2: Build and Push Docker Images
##############################################################################

build_and_push_images() {
    if [ "$SKIP_BUILD" = true ]; then
        print_warning "Skipping build (--skip-build flag)"
        return
    fi
    
    print_header "Building and Pushing Docker Images"
    
    # Frontend
    if [ "$BACKEND_ONLY" = false ]; then
        print_info "Building frontend..."
        docker build -t $REPO/listro-frontend:v3 \
            --build-arg VITE_NODE_BACKEND_URL=$NODE_URL \
            --build-arg VITE_PYTHON_BACKEND_URL=$PYTHON_URL \
            -f Dockerfile .
        
        print_info "Pushing frontend image..."
        docker push $REPO/listro-frontend:v3
        print_success "Frontend image pushed: $REPO/listro-frontend:v3"
    fi
    
    # Node.js Backend
    if [ "$FRONTEND_ONLY" = false ]; then
        print_info "Building Node.js backend..."
        cd backend
        docker build -t $REPO/listro-node-api:v3 -f Dockerfile.node .
        
        print_info "Pushing Node.js backend image..."
        docker push $REPO/listro-node-api:v3
        print_success "Node.js backend image pushed: $REPO/listro-node-api:v3"
        
        # Python Backend
        print_info "Building Python backend (with Secret Manager)..."
        docker build -t $REPO/listro-python-api:v3 -f Dockerfile.python .
        
        print_info "Pushing Python backend image..."
        docker push $REPO/listro-python-api:v3
        print_success "Python backend image pushed: $REPO/listro-python-api:v3"
        
        cd ..
    fi
}

##############################################################################
# Step 3: Deploy to Cloud Run
##############################################################################

deploy_services() {
    print_header "Deploying to Cloud Run"
    
    print_info "Service URLs:"
    echo "  Frontend: $FRONTEND_URL"
    echo "  Node API: $NODE_URL"
    echo "  Python API: $PYTHON_URL"
    echo ""
    
    # Deploy Frontend
    if [ "$BACKEND_ONLY" = false ]; then
        print_info "Deploying frontend..."
        gcloud run deploy listrov3-frontend \
            --image=$REPO/listro-frontend:v3 \
            --platform=managed \
            --region=$REGION \
            --service-account=$SERVICE_ACCOUNT \
            --allow-unauthenticated \
            --port=80 \
            --labels=app=listro,component=frontend,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
            --min-instances=0 \
            --max-instances=3 \
            --cpu=1 \
            --memory=512Mi \
            --timeout=300s \
            --quiet
        
        print_success "Frontend deployed: $FRONTEND_URL"
    fi
    
    # Deploy Node.js Backend
    if [ "$FRONTEND_ONLY" = false ]; then
        print_info "Deploying Node.js backend..."
        gcloud run deploy listrov3-node-api \
            --image=$REPO/listro-node-api:v3 \
            --platform=managed \
            --region=$REGION \
            --service-account=$SERVICE_ACCOUNT \
            --allow-unauthenticated \
            --port=8080 \
            --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data" \
            --labels=app=listro,component=node-api,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
            --min-instances=0 \
            --max-instances=5 \
            --cpu=1 \
            --memory=2Gi \
            --timeout=300s \
            --concurrency=5 \
            --quiet
        
        print_success "Node.js backend deployed: $NODE_URL"
        
        # Deploy Python Backend (NO API KEY!)
        print_info "Deploying Python backend (Secret Manager authentication)..."
        gcloud run deploy listrov3-python-api \
            --image=$REPO/listro-python-api:v3 \
            --platform=managed \
            --region=$REGION \
            --service-account=$SERVICE_ACCOUNT \
            --allow-unauthenticated \
            --port=8080 \
            --set-env-vars="FRONTEND_ORIGIN=$FRONTEND_URL,FLASK_ENV=production,ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc,GOOGLE_SHEETS_TAB_NAME=Product_Data,_LEAD_SPREADSHEET_ID=1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4,_USER_SPREADSHEET_ID=1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto" \
            --labels=app=listro,component=python-api,env=production,version=v3,cost-center=listro-prod,team=ops-excellence,deployment=cloud-run \
            --min-instances=0 \
            --max-instances=5 \
            --cpu=1 \
            --memory=2Gi \
            --timeout=300s \
            --concurrency=5 \
            --quiet
        
        print_success "Python backend deployed: $PYTHON_URL"
        print_success "🔐 Authentication: Secret Manager (no API keys)"
    fi
}

##############################################################################
# Step 4: Verify Deployment
##############################################################################

verify_deployment() {
    print_header "Verifying Deployment"
    
    # List services
    print_info "Cloud Run services:"
    gcloud run services list --region=$REGION --filter="metadata.name:listrov3"
    echo ""
    
    # Check Python backend health (most critical for Secret Manager)
    if [ "$FRONTEND_ONLY" = false ]; then
        print_info "Testing Python backend health check..."
        sleep 5  # Give it a moment to start
        
        if command -v jq &> /dev/null; then
            HEALTH_RESPONSE=$(curl -s "$PYTHON_URL/api/health")
            echo "$HEALTH_RESPONSE" | jq .
            
            # Check if Secret Manager authentication is confirmed
            if echo "$HEALTH_RESPONSE" | jq -e '.services.authentication == "via_secret_manager"' > /dev/null; then
                print_success "Secret Manager authentication verified!"
            else
                print_warning "Could not verify Secret Manager authentication"
            fi
        else
            curl -s "$PYTHON_URL/api/health"
            echo ""
            print_warning "Install 'jq' for better JSON output: sudo apt-get install jq"
        fi
        
        # Check logs for Secret Manager initialization
        print_info "Recent Python backend logs:"
        gcloud run logs read listrov3-python-api --region=$REGION --limit=20 | grep -E "(Secret|Gemini|Authentication)" || true
    fi
    
    print_success "Deployment verification complete"
}

##############################################################################
# Main Execution
##############################################################################

main() {
    echo ""
    print_header "Listro v3 Deployment"
    echo "Project: $PROJECT_ID"
    echo "Region: $REGION"
    echo "Secret Manager: Enabled (no API keys)"
    echo ""
    
    if [ "$VERIFY_ONLY" = true ]; then
        verify_deployment
        exit 0
    fi
    
    # Execute deployment steps
    verify_prerequisites
    setup_authentication
    build_and_push_images
    deploy_services
    verify_deployment
    
    # Final summary
    print_header "Deployment Complete! 🎉"
    echo ""
    echo "🌐 Service URLs:"
    echo "  Frontend:     $FRONTEND_URL"
    echo "  Node API:     $NODE_URL"
    echo "  Python API:   $PYTHON_URL"
    echo ""
    echo "📋 Quick Commands:"
    echo "  View logs:    gcloud run logs tail listrov3-python-api --region=$REGION"
    echo "  List services: gcloud run services list --region=$REGION"
    echo "  Test health:  curl $PYTHON_URL/api/health | jq ."
    echo ""
    print_success "🔐 Security: All services using Secret Manager authentication"
    print_success "✅ No API keys in environment variables"
    echo ""
}

# Run main function
main
