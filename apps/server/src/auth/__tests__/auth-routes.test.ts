import type { Server } from 'node:http';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// A minimal passport strategy named 'google' so we can exercise the real
// authRouter without hitting Google. On the initiate request it redirects
// (like the real OAuth2 strategy); on the callback it succeeds, which makes
// passport call req.login() → req.session.regenerate(). That regeneration is
// the exact mechanism that wiped `returnTo` and is what this test guards.
class MockGoogleStrategy {
  name = 'google';
  authenticate(this: passport.Strategy, req: express.Request) {
    if (req.path.includes('/callback')) {
      // self.success is provided by passport at runtime
      (this as unknown as { success: (u: unknown) => void }).success({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'A',
      });
    } else {
      (this as unknown as { redirect: (url: string) => void }).redirect(
        'https://accounts.google.com/o/oauth2/v2/auth'
      );
    }
  }
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  // Required for `oauthConfigured` to be true at import time.
  process.env.GOOGLE_CLIENT_ID = 'test-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'postgres://test';
  process.env.NODE_ENV = 'production';

  passport.use(new MockGoogleStrategy() as unknown as passport.Strategy);
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj: Express.User, done) => done(null, obj));

  const { authRouter } = await import('../auth-routes.js');

  const app = express();
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use('/auth', authRouter);

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe('OAuth returnTo redirect', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startServer());
  });

  afterAll(() => {
    server.close();
  });

  async function loginFlow(returnToQuery: string): Promise<string | null> {
    // 1. Initiate: stores returnTo in the session, sets the session cookie.
    const initiate = await fetch(`${baseUrl}/auth/google${returnToQuery}`, {
      redirect: 'manual',
    });
    const cookie = initiate.headers.get('set-cookie')?.split(';')[0] ?? '';

    // 2. Callback: passport logs in (regenerating the session) then redirects.
    const callback = await fetch(`${baseUrl}/auth/google/callback`, {
      redirect: 'manual',
      headers: { cookie },
    });
    return callback.headers.get('location');
  }

  it('redirects back to the original room URL after login', async () => {
    const location = await loginFlow(
      `?returnTo=${encodeURIComponent('/room/ABC123')}`
    );
    expect(location).toBe('/room/ABC123');
  });

  it('redirects to / when no returnTo was provided', async () => {
    const location = await loginFlow('');
    expect(location).toBe('/');
  });

  it('ignores a protocol-relative returnTo (open-redirect guard)', async () => {
    const location = await loginFlow(
      `?returnTo=${encodeURIComponent('//evil.com')}`
    );
    expect(location).toBe('/');
  });
});
