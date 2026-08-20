import type { Profile } from 'passport-google-oauth20';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the verify callback that configurePassport() hands to the strategy,
// so the allowlist check can be exercised without touching Google or passport's
// internals.
type VerifyCallback = (
  accessToken: string,
  refreshToken: string,
  profile: Profile,
  done: (err: Error | null, user?: unknown, info?: { message: string }) => void
) => void;

let capturedVerify: VerifyCallback | undefined;

/**
 * Hands back the verify callback captured by the most recent
 * `configurePassport()` and clears it, so a run that failed to capture one
 * throws rather than silently reusing the previous test's callback.
 */
function takeVerify(): VerifyCallback {
  const verify = capturedVerify;
  capturedVerify = undefined;
  if (!verify) throw new Error('verify callback was never captured');
  return verify;
}

vi.mock('passport-google-oauth20', () => ({
  Strategy: class {
    name = 'google';
    constructor(_options: unknown, verify: VerifyCallback) {
      capturedVerify = verify;
    }
  },
}));

vi.mock('passport', () => ({
  default: {
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
  },
}));

const query = vi.fn();
vi.mock('../../db/client.js', () => ({
  pool: {
    query: (...args: unknown[]) => query(...args) as unknown,
  },
}));

function profileFor(email: string): Profile {
  return {
    id: 'google-123',
    displayName: 'Bob Example',
    name: { givenName: 'Bob', familyName: 'Example' },
    emails: [{ value: email, verified: 'true' }],
    photos: [{ value: 'https://example.com/p.jpg' }],
  } as unknown as Profile;
}

interface VerifyResult {
  err: Error | null;
  user?: unknown;
  info?: { message: string };
}

/**
 * Loads a fresh copy of passport-config with the given ALLOWED_EMAILS, runs the
 * strategy's verify callback against `profile`, and resolves with whatever it
 * passed to `done`.
 */
async function verifyProfile(
  allowlist: string | undefined,
  profile: Profile
): Promise<VerifyResult> {
  vi.resetModules();

  if (allowlist === undefined) {
    delete process.env.ALLOWED_EMAILS;
  } else {
    process.env.ALLOWED_EMAILS = allowlist;
  }

  const { configurePassport } = await import('../passport-config.js');
  configurePassport();

  const verify = takeVerify();

  return new Promise((resolve) => {
    verify('at', 'rt', profile, (err, user, info) => {
      resolve({ err, user, info });
    });
  });
}

function verifyEmail(
  allowlist: string | undefined,
  email: string
): Promise<VerifyResult> {
  return verifyProfile(allowlist, profileFor(email));
}

describe('ALLOWED_EMAILS allowlist', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [{ id: 'u1', email: 'bob@gmail.com' }] });
  });

  it('admits an address that matches the allowlist exactly', async () => {
    const { err, user } = await verifyEmail('bob@gmail.com', 'bob@gmail.com');
    expect(err).toBeNull();
    expect(user).toMatchObject({ id: 'u1' });
  });

  // The regression: entries were compared case-sensitively against an address
  // that had already been lowercased, so any capital in the env var silently
  // locked the user out.
  it('admits when the allowlist entry has different casing', async () => {
    const { err, user, info } = await verifyEmail(
      'Bob@Gmail.com',
      'bob@gmail.com'
    );
    expect(info).toBeUndefined();
    expect(err).toBeNull();
    expect(user).toMatchObject({ id: 'u1' });
  });

  it('admits when the incoming address has different casing', async () => {
    const { err, user } = await verifyEmail('bob@gmail.com', 'BOB@Gmail.com');
    expect(err).toBeNull();
    expect(user).toMatchObject({ id: 'u1' });
  });

  it('tolerates whitespace and mixed casing across a multi-entry list', async () => {
    const { err, user } = await verifyEmail(
      'Alice@Example.com ,  BOB@gmail.com , carol@example.com',
      'bob@gmail.com'
    );
    expect(err).toBeNull();
    expect(user).toMatchObject({ id: 'u1' });
  });

  it('rejects an address that is not on the allowlist', async () => {
    const { err, user, info } = await verifyEmail(
      'alice@example.com',
      'mallory@example.com'
    );
    expect(err).toBeNull();
    expect(user).toBe(false);
    expect(info).toEqual({ message: 'not_allowed' });
    // A rejected user must never reach the users table.
    expect(query).not.toHaveBeenCalled();
  });

  it('admits everyone when the allowlist is empty', async () => {
    const { err, user } = await verifyEmail('', 'anyone@example.com');
    expect(err).toBeNull();
    expect(user).toMatchObject({ id: 'u1' });
  });

  it('admits everyone when the allowlist is unset', async () => {
    const { err, user } = await verifyEmail(undefined, 'anyone@example.com');
    expect(err).toBeNull();
    expect(user).toMatchObject({ id: 'u1' });
  });

  it('rejects a profile with no email when an allowlist is set', async () => {
    const profile = { ...profileFor('x@y.com'), emails: undefined };
    const { user, info } = await verifyProfile('bob@gmail.com', profile);
    expect(user).toBe(false);
    expect(info).toEqual({ message: 'not_allowed' });
  });
});
