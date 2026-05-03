# Production Deployment Script
# Run this script to deploy to production environment
# WARNING: This deploys to production - use with caution!

Write-Host "Starting Production Deployment..." -ForegroundColor Green

# Confirm deployment
$confirmation = Read-Host "Are you sure you want to deploy to production? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# Check if .env.production exists
if (-not (Test-Path ".env.production")) {
    Write-Host "Error: .env.production not found. Please create it first." -ForegroundColor Red
    exit 1
}

# Copy environment file
Write-Host "Setting up environment..." -ForegroundColor Yellow
Copy-Item ".env.production" ".env.local" -Force

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm ci

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build

# Deploy (placeholder - replace with actual deployment command)
Write-Host "Deploying to production..." -ForegroundColor Yellow
# npm run deploy

Write-Host "Production deployment complete!" -ForegroundColor Green
