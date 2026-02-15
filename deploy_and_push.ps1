# Deploy & Push Script
# This script automates the git commit and push process

Write-Host "🚀 Starting Deployment Process..." -ForegroundColor Cyan

# 1. Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "Error: Git is not initialized in this directory." -ForegroundColor Red
    exit
}

# 2. Add all changes
Write-Host "📦 Adding all changes..." -ForegroundColor Yellow
git add .

# 3. Commit changes
$commitMessage = Read-Host "Enter commit message (default: 'Updates and visual overhaul')"
if ($commitMessage -eq "") {
    $commitMessage = "Updates and visual overhaul"
}
git commit -m "$commitMessage"

# 4. Push to main
Write-Host "⬆️ Pushing to origin main..." -ForegroundColor Yellow
git push origin main

if ($?) {
    Write-Host "✅ Git push successful!" -ForegroundColor Green
    Write-Host "------------------------------------------------"
    Write-Host "🚀 To deploy to Vercel:" -ForegroundColor Cyan
    Write-Host "1. If you have Vercel CLI installed, run: vercel --prod" -ForegroundColor White
    Write-Host "2. Or go to your Vercel dashboard and redeploy the latest commit." -ForegroundColor White
} else {
    Write-Host "❌ Git push failed. Please check your remote configuration." -ForegroundColor Red
}
