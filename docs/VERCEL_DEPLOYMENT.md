# Vercel Deployment Guide

This guide covers deploying OptiSched to Vercel with separate development and production configurations.

## Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- Supabase project ([supabase.com](https://supabase.com))
- Git repository (GitHub, GitLab, or Bitbucket)
- Node.js 18+ installed locally

## Environment Variables

Required for both development and production:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_KEY` | Supabase anon/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings → API**
4. Copy the **Project URL** → `VITE_SUPABASE_URL`
5. Copy the **anon/public** key → `VITE_SUPABASE_KEY`

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

Ensure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket).

### Step 2: Create Development Deployment

1. Log in to [Vercel](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository
4. **Important:** Set the project name to something **unrelated to optisched** for development
   - Example: `dev-scheduler-2024`, `test-schedule-app`, `temp-scheduler`
5. Configure the project:
   - **Framework Preset:** Vite
   - **Root Directory:** `web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_KEY`: Your Supabase anon key
7. Click **"Deploy"**

Your development deployment will be available at:
- `https://<your-dev-name>.vercel.app`

### Step 3: Reserve Production Domain

1. In Vercel, go to your project's **Settings** tab
2. Navigate to **Domains**
3. Click **"Add"** and enter: `optisched.vercel.app`
4. Click **"Add"** to reserve the domain
5. **Do not set this as the production domain** - leave it as reserved only
6. The domain will show as "Reserved" status

### Step 4: Configure Production Environment (Future Deployment)

When ready to deploy to production:

1. Create a new Vercel project or use a separate branch
2. Set project name to `optisched-production` (or similar)
3. Configure same build settings as development
4. Add production environment variables (use production Supabase project if separate)
5. In **Domains** settings:
   - Remove any default `.vercel.app` domain
   - Add the reserved `optisched.vercel.app` domain
   - Set it as the production domain

### Step 5: Deploy Preview Environments (Optional)

Vercel automatically creates preview deployments for:
- Every pull request
- Every git branch

These use the same environment variables as the development deployment.

## Local Development with Vercel CLI

### Install Vercel CLI

```bash
npm i -g vercel
```

### Link Your Project

```bash
cd web
vercel link
```

### Pull Environment Variables

```bash
vercel env pull .env.local
```

### Run Local Development

```bash
cd web
npm install
npm run dev
```

## Build Configuration

The project uses Vite with the following configuration:

- **Root Directory:** `web`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Framework:** Vite

## Custom Domain Configuration (Future)

To use a custom domain (e.g., `optisched.yourdomain.com`):

1. Purchase domain from registrar (Namecheap, GoDaddy, etc.)
2. In Vercel project → **Settings → Domains**
3. Click **"Add"** and enter your custom domain
4. Follow Vercel's DNS configuration instructions
5. Update DNS records at your registrar

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `cd web && npm install`
- Check build output: `cd web && npm run build`
- Verify environment variables are set in Vercel project settings

### Supabase Connection Errors

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` are correct
- Check Supabase project is active (not paused)
- Ensure Supabase RLS policies allow anonymous access where needed

### 404 Errors on Navigation

- Vercel handles SPA routing via `vercel.json` rewrites
- Ensure `vercel.json` is in the `web` directory

### Environment Variables Not Working

- Variables must start with `VITE_` prefix for Vite
- Check variable names match exactly (case-sensitive)
- Re-deploy after adding/changing variables

## Security Best Practices

1. **Never commit `.env` files** to Git
2. Use different Supabase projects for dev/staging/production
3. Rotate Supabase keys regularly
4. Enable Vercel password protection for preview deployments if needed
5. Use Vercel Analytics to monitor performance

## Monitoring

- **Vercel Dashboard:** View deployment logs, analytics, and performance
- **Supabase Dashboard:** Monitor database queries, auth logs, and storage
- **Vercel Analytics:** Track page views, Core Web Vitals, and user journeys

## CI/CD Pipeline

Vercel automatically handles CI/CD:

1. Push to Git → Automatic preview deployment
2. Merge to main branch → Automatic production deployment
3. Rollback available via deployment history

## Cost Considerations

- **Vercel:** Free tier includes:
  - Unlimited deployments
  - 100GB bandwidth/month
  - 6,000 minutes of build time/month
- **Supabase:** Free tier includes:
  - 500MB database storage
  - 1GB file storage
  - 2GB bandwidth/month

Upgrade to paid tiers if exceeding limits.
