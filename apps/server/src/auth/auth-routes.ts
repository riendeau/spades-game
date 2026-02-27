import express from 'express';
import passport from 'passport';
import type { User } from './passport-config.js';
import { DEV_USER } from './passport-config.js';

// Extend express-session's SessionData so passport's failure messages are typed
declare module 'express-session' {
  interface SessionData {
    messages?: string[];
    returnTo?: string;
  }
}

export const authRouter: express.Router = express.Router();

const oauthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.DATABASE_URL
);

// Initiate Google OAuth flow
authRouter.get('/google', (req, res, next) => {
  if (!oauthConfigured) {
    res.status(503).send('OAuth not configured on this server.');
    return;
  }

  // Preserve the original URL so we can redirect back after login
  const returnTo = req.query.returnTo;
  if (
    typeof returnTo === 'string' &&
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//')
  ) {
    req.session.returnTo = returnTo;
  }

  passport.authenticate('google', { scope: ['profile', 'email'] })(
    req,
    res,
    next
  );
});

// OAuth callback
authRouter.get('/google/callback', (req, res, next) => {
  if (!oauthConfigured) {
    res.status(503).send('OAuth not configured on this server.');
    return;
  }
  passport.authenticate('google', { failureMessage: true, session: true })(
    req,
    res,
    () => {
      // Check if the failure was due to allowlist rejection
      const messages = req.session.messages;
      if (messages?.includes('not_allowed')) {
        req.session.messages = [];
        res.redirect('/?error=not_allowed');
        return;
      }
      const returnTo = req.session.returnTo;
      delete req.session.returnTo;
      res.redirect(returnTo ?? '/');
    }
  );
});

// Logout
authRouter.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Current user info
authRouter.get('/me', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    res.json(DEV_USER);
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = req.user as User;
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
  });
});
