import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from '../db/client.js';

export interface User {
  id: string;
  email: string;
  displayName: string;
  pictureUrl: string | null;
}

// Augment Express.User so req.user is typed across the app.
// The namespace syntax is required for declaration merging with the Express
// global that passport reads from — there is no ES module alternative.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string;
      pictureUrl: string | null;
    }
  }
}

const DEV_USER: User = {
  id: 'dev-user',
  email: 'dev@localhost',
  displayName: 'Dev User',
  pictureUrl: null,
};

export { DEV_USER };

export function configurePassport(): void {
  const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: '/auth/google/callback',
      },
      // Use void IIFE to avoid no-misused-promises on async verify callback
      (_accessToken, _refreshToken, profile, done) => {
        void (async () => {
          const email = profile.emails?.[0]?.value?.toLowerCase() ?? '';

          if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
            done(null, false, { message: 'not_allowed' });
            return;
          }

          const displayName = profile.name?.givenName ?? profile.displayName;
          const pictureUrl = profile.photos?.[0]?.value ?? null;

          const result = await pool.query<User>(
            `INSERT INTO users (google_id, email, display_name, picture_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (google_id) DO UPDATE
               SET display_name = EXCLUDED.display_name,
                   picture_url  = EXCLUDED.picture_url
             RETURNING id, email, display_name AS "displayName", picture_url AS "pictureUrl"`,
            [profile.id, email, displayName, pictureUrl]
          );

          done(null, result.rows[0]);
        })().catch((err: Error) => {
          done(err);
        });
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  // Use promise chain to avoid no-misused-promises on async deserializeUser
  passport.deserializeUser((id: string, done) => {
    pool
      .query<User>(
        `SELECT id, email, display_name AS "displayName", picture_url AS "pictureUrl"
         FROM users WHERE id = $1`,
        [id]
      )
      .then((result) => {
        done(null, result.rows[0] ?? null);
      })
      .catch((err: Error) => {
        done(err);
      });
  });
}
