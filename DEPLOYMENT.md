# Deployment Guide

This guide covers deploying the Spades game to production.

## Deployment Options

### Option 1: Subdomain (Recommended - Simpler)

Deploy at `spades.yourdomain.com` (or any subdomain)

- ✅ Simpler setup, no reverse proxy needed
- ✅ Deploy at root path (`BASE_PATH=/`)

### Option 2: Path on Existing Domain

Deploy at `yourdomain.com/spades`

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
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from the Google OAuth client
   - `SESSION_SECRET` — 32+ random characters, signs the session cookie
   - `ALLOWED_EMAILS` — see [Managing Authorized Users](#managing-authorized-users)
   - `ANTHROPIC_API_KEY` — optional; without it the team-name feature is inert

   These are all declared `sync: false` in `render.yaml`, meaning Render expects
   them from the dashboard and they are deliberately not in git. `DATABASE_URL`
   is the exception — Render populates it from the linked `spades-db` resource.

6. **Deploy**: Click "Create Web Service"

Render will build and deploy your app. You'll get a URL like `spades-game.onrender.com`.

### DNS Configuration

#### For Subdomain Deployment (spades.yourdomain.com):

1. In your domain registrar (wherever yourdomain.com is hosted):
   - Add a CNAME record:
     - Name: `spades`
     - Value: `spades-game.onrender.com` (your Render URL without https://)
     - TTL: 3600 (or default)

2. In Render:
   - Go to your service → "Settings" → "Custom Domain"
   - Add `spades.yourdomain.com`
   - Wait for SSL certificate to provision (~5 minutes)

#### For Path Deployment (yourdomain.com/spades):

This requires a reverse proxy at your main domain. If yourdomain.com is hosted on:

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

## Managing Authorized Users

Access is gated in **two independent places**, and a new player must be added to
both. Neither is a code change — both are dashboard settings, so there is no
commit and no PR involved.

### 1. Google Cloud Console — test users

Only required while the OAuth app's publishing status is **Testing**. Go to
[console.cloud.google.com](https://console.cloud.google.com/) → your project →
**APIs & Services** → **OAuth consent screen** → **Audience**.

- **Publishing status: Testing** → under **Test users**, click **+ Add users**,
  enter the address, **Save**. Google caps this list at 100 users.
- **Publishing status: In production** → nothing to do here. Any Google account
  can reach the consent screen, and `ALLOWED_EMAILS` is the only gate.

### 2. Render — the `ALLOWED_EMAILS` allowlist

[dashboard.render.com](https://dashboard.render.com/) → the **spades-game**
service → **Environment** → edit `ALLOWED_EMAILS`, append `,new@example.com`
to the existing comma-separated list → **Save**.

One non-obvious constraint, from `configurePassport()` in
`apps/server/src/auth/passport-config.ts`:

- **A restart is required.** `allowedEmails` is parsed once, when
  `configurePassport()` runs at boot, not per login request. Saving an
  environment variable in Render triggers a redeploy, which satisfies this —
  but the change is not live until that redeploy finishes.

Casing and surrounding whitespace do not matter: entries are trimmed and
lowercased at parse time, and the address from Google is lowercased too, so
` Bob@Gmail.com` and `bob@gmail.com` are equivalent.

Note also that an **empty** `ALLOWED_EMAILS` disables the allowlist entirely
(`allowedEmails.length > 0 &&` short-circuits), letting any Google account in.
Clearing the variable is not a way to lock the app down.

### Verifying, and reading a failure

Once the redeploy is green, have the new player sign in. Where it breaks tells
you which half is wrong:

| Symptom                                                                           | Cause                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------- |
| Google's own "app hasn't completed verification" / "you don't have access" screen | Step 1 — not on the test-user list                |
| Google sign-in succeeds, then bounces back to the login gate                      | Step 2 — missing from `ALLOWED_EMAILS`, or a typo |
| Everyone is locked out after an edit                                              | Malformed list, or the redeploy hasn't finished   |

Server-side, a rejected address fails the strategy with `{ message: 'not_allowed' }`
before any database write, so a blocked user never gets a `users` row.

### Removing a user

Delete the address from `ALLOWED_EMAILS` (and from the Google test-user list if
in Testing) and let the redeploy land. Their existing session cookie stays valid
until it expires — the allowlist is only consulted during the OAuth verify
callback, not on `deserializeUser`. Delete their row from the `users` table to
force a re-login; the `game_results` player columns are
`ON DELETE SET NULL`, so past games survive.

### Local development

None of this applies locally. When `NODE_ENV !== 'production'` the server injects
`DEV_USER` into every request and skips the Socket.io auth check entirely, so
`pnpm dev` needs no Google credentials, no database, and no allowlist.

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
