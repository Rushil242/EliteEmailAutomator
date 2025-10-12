# Vercel Deployment Guide

## Overview
This guide explains how to deploy your Elite IIT Marketing Automation app to Vercel with both frontend and backend working correctly.

## What Was Created

### 1. `api/index.ts`
- Serverless function entry point for Vercel
- Handles all `/api/*` routes
- Configured to work with Vercel's serverless environment
- Uses serverless-specific route registration

### 2. `server/routes-serverless.ts`
- Serverless-compatible route definitions
- Same functionality as `server/routes.ts` but without server creation
- Optimized for Vercel's serverless functions

### 3. `vercel.json`
- Vercel configuration file
- Routes API requests to serverless functions
- Configures build command and output directory
- Sets function timeout to 60 seconds

## Deployment Steps

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

### Step 2: Import Project to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect the configuration

### Step 3: Configure Environment Variables
In Vercel dashboard, go to **Settings > Environment Variables** and add:

#### Required Variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

#### Required for AI Features:
- `OPENROUTER_API_KEY` - For AI message generation (get from https://openrouter.ai/keys)
- `FREEPIK_API_KEY` - For AI image generation (get from https://www.freepik.com/api)

#### Optional Variables:
- `BREVO_API_KEY` - For email campaigns (get from https://app.brevo.com/settings/keys/api)

**Important:** Make sure to add these for both **Production** and **Preview** environments.

### Step 4: Deploy
1. Click **"Deploy"** in Vercel
2. Wait for build to complete
3. Your app will be live at `https://your-project.vercel.app`

## How It Works

### Frontend
- Built using Vite: `npm run build`
- Output directory: `dist/public`
- Served as static files by Vercel

### Backend (API Routes)
- All `/api/*` requests are routed to `api/index.ts`
- Runs as serverless function on Vercel
- Express app with all your routes (upload, campaigns, AI generation, etc.)

### Routing Flow
```
User Request → Vercel
   ↓
/api/* → Serverless Function (api/index.ts)
   ↓
Other → Static Files (dist/public)
```

## Testing After Deployment

1. **Test Frontend:** Visit your Vercel URL
2. **Test Login:** Try Supabase authentication
3. **Test API:** Upload contacts, create campaigns, etc.
4. **Check Logs:** View function logs in Vercel dashboard

## Common Issues & Solutions

### Issue 1: API Routes Return 404
**Solution:** Make sure `vercel.json` exists and API routes are properly configured.

### Issue 2: Environment Variables Not Working
**Solution:** 
- Verify all environment variables are set in Vercel dashboard
- Redeploy after adding new environment variables
- Frontend variables must start with `VITE_`

### Issue 3: Build Fails
**Solution:** 
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Run `npm run build` locally to test

### Issue 4: Function Timeout
**Solution:** 
- Default timeout is 60 seconds (configured in vercel.json)
- For longer operations, consider Vercel Pro plan (up to 300s)
- Optimize API operations for faster execution

### Issue 5: File Upload Issues
**Solution:**
- Vercel has a 4.5MB request body limit on Hobby plan
- For larger files, upgrade to Pro plan or use external storage

## Continuous Deployment

Once set up, Vercel automatically:
- Deploys on every push to `main` branch (Production)
- Creates preview deployments for pull requests
- Provides unique URLs for each deployment

## Monitoring

Access Vercel dashboard to:
- View deployment logs
- Monitor function invocations
- Check error rates
- Analyze performance metrics

## Environment Comparison

| Feature | Replit | Vercel |
|---------|--------|--------|
| Server Type | Always-on Express | Serverless Functions |
| Port | 5000 (fixed) | Managed by Vercel |
| Static Files | Vite dev server | CDN (production build) |
| Scaling | Single instance | Auto-scales |
| Cold Starts | None | ~1-2 seconds |

## Notes

- The original `server/index.ts` is preserved for Replit development
- `api/index.ts` is used only for Vercel deployment
- Both use the same routes from `server/routes.ts`
- No code duplication - just different entry points
