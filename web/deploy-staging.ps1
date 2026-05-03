# Staging Deployment Script
# Run this script to deploy to staging environment

Write-Host "Starting Staging Deployment..." -ForegroundColor Green

# Check if .env.staging exists
if (-not (Test-Path ".env.staging")) {
    Write-Host "Error: .env.staging not found. Please create it first." -ForegroundColor Red
    exit 1
}

# Copy environment file
Write-Host "Setting up environment..." -ForegroundColor Yellow
Copy-Item ".env.staging" ".env.local" -Force

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm ci

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build

# Deploy (placeholder - replace with actual deployment command)
Write-Host "Deploying to staging..." -ForegroundColor Yellow
# npm run deploy

Write-Host "Staging deployment complete!" -ForegroundColor Green
