# Deployment Guide

This guide covers deploying the Spades game to production.

## Deployment Options

### Option 1: Subdomain (Recommended - Simpler)

Deploy at `spades.johnriendeau.com` (or any subdomain)

- ✅ Simpler setup, no reverse proxy needed
- ✅ Deploy at root path (`BASE_PATH=/`)

### Option 2: Path on Existing Domain

Deploy at `johnriendeau.com/spades`

- ⚠️ Requires reverse proxy configuration on your main domain
- ⚠️ Set `BASE_PATH=/spades`

## Deploying to Render

### Prerequisites

- GitHub account with this repository pushed
- Render account (free tier available at render.com)

### Steps

1. **Push Code to GitHub** (if not already done):

   ```bash
   git remote add origin https://github.com/yourusername/spades-game.git
   git push -u origin main
   ```

2. **Create Render Account**: Go to [render.com](https://render.com) and sign up

3. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `spades-game` repository

4. **Configure Build Settings**:
   - **Name**: `spades-game` (or whatever you prefer)
   - **Environment**: `Node`
   - **Build Command**: `pnpm install && pnpm build:prod`
   - **Start Command**: `pnpm start`
   - **Instance Type**: Free (or paid for no cold starts)

5. **Set Environment Variables**:
   Click "Environment" and add:
   - `SERVE_CLIENT` = `true`
   - `BASE_PATH` = `/` (or `/spades` if using path deployment)
   - `NODE_ENV` = `production`

6. **Deploy**: Click "Create Web Service"

Render will build and deploy your app. You'll get a URL like `spades-game.onrender.com`.

### DNS Configuration

#### For Subdomain Deployment (spades.johnriendeau.com):

1. In your domain registrar (wherever johnriendeau.com is hosted):
   - Add a CNAME record:
     - Name: `spades`
     - Value: `spades-game.onrender.com` (your Render URL without https://)
     - TTL: 3600 (or default)

2. In Render:
   - Go to your service → "Settings" → "Custom Domain"
   - Add `spades.johnriendeau.com`
   - Wait for SSL certificate to provision (~5 minutes)

#### For Path Deployment (johnriendeau.com/spades):

This requires a reverse proxy at your main domain. If johnriendeau.com is hosted on:

**Nginx**:

```nginx
location /spades {
    proxy_pass https://spades-game.onrender.com/spades;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**Apache** (.htaccess):

```apache
ProxyPass /spades https://spades-game.onrender.com/spades
ProxyPassReverse /spades https://spades-game.onrender.com/spades
```

## Local Production Testing

Test production build locally before deploying:

```bash
# Build with production settings
BASE_PATH=/ pnpm build:prod

# Run production build
SERVE_CLIENT=true BASE_PATH=/ pnpm start
```

Visit `http://localhost:3001`

## Troubleshooting

### "Service Unavailable" after deployment

- Check Render logs for build errors
- Ensure all environment variables are set
- Verify `SERVE_CLIENT=true` is set

### WebSocket connection fails

- Ensure your reverse proxy (if using one) forwards WebSocket connections
- Check that Socket.io path matches between client and server

### 404 errors on refresh

- Ensure SPA fallback is working
- Check `BASE_PATH` matches between client build and server config

### Cold starts (free tier)

- Free Render instances spin down after inactivity
- First request after 15min may take 30-60 seconds
- Upgrade to paid instance ($7/month) for always-on service
