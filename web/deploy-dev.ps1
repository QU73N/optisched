# Development Deployment Script
# Run this script to deploy to development environment

Write-Host "Starting Development Deployment..." -ForegroundColor Green

# Check if .env.development exists
if (-not (Test-Path ".env.development")) {
    Write-Host "Error: .env.development not found. Please create it first." -ForegroundColor Red
    exit 1
}

# Copy environment file
Write-Host "Setting up environment..." -ForegroundColor Yellow
Copy-Item ".env.development" ".env.local" -Force

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm ci

# Build the application
Write-Host "Building application..." -ForegroundColor Yellow
npm run build

# Deploy (placeholder - replace with actual deployment command)
Write-Host "Deploying to development..." -ForegroundColor Yellow
# npm run deploy

Write-Host "Development deployment complete!" -ForegroundColor Green
