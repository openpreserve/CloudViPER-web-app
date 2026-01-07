#!/bin/bash
#
# Build and push Docker image to Google Artifact Registry
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="opf-viper-cloud"
REGION="australia-southeast2"
REPOSITORY="opf-viper-repo"
IMAGE_NAME="web-app"
IMAGE_TAG="${IMAGE_TAG:-latest}"

FULL_IMAGE_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Building and Pushing to Google Artifact Registry"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${BLUE}Project:${NC}    ${PROJECT_ID}"
echo -e "${BLUE}Region:${NC}     ${REGION}"
echo -e "${BLUE}Repository:${NC} ${REPOSITORY}"
echo -e "${BLUE}Image:${NC}      ${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "${BLUE}Full Path:${NC}  ${FULL_IMAGE_PATH}"
echo

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}✗ Error: gcloud CLI not found${NC}"
    echo "  Please install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Error: docker not found${NC}"
    exit 1
fi

# Verify we're in the correct project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠ Warning: Current project is '${CURRENT_PROJECT}'${NC}"
    echo "  Switching to project '${PROJECT_ID}'..."
    gcloud config set project "$PROJECT_ID"
fi

echo -e "${GREEN}✓${NC} Authenticated to project: ${PROJECT_ID}"
echo

# Configure Docker to use gcloud for authentication
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Configuring Docker Authentication"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
echo -e "${GREEN}✓${NC} Docker authentication configured"
echo

# Build the Docker image
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Building Docker Image"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Building: ${FULL_IMAGE_PATH}"
echo

docker build -t "$FULL_IMAGE_PATH" -f Dockerfile .

echo
echo -e "${GREEN}✓${NC} Image built successfully"
echo

# Push the image to Artifact Registry
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Pushing to Artifact Registry"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pushing: ${FULL_IMAGE_PATH}"
echo

docker push "$FULL_IMAGE_PATH"

echo
echo -e "${GREEN}✓${NC} Image pushed successfully"
echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Build and Push Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${GREEN}✓${NC} Image available at:"
echo "  ${FULL_IMAGE_PATH}"
echo
echo "You can now deploy to GKE using:"
echo "  ./scripts/deploy-to-gke-simple.sh"
echo
echo "Or manually with:"
echo "  kubectl apply -f k8s/"
echo
