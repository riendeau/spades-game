// Single source of the sessionStorage read/write policy.
//
// Every persisted value in this app (the session token, the See Cards
// decision, the debug breadcrumb buffer) is a recovery aid rather than
// load-bearing state, so storage access is uniformly best-effort: nothing here
// throws, and a value that isn't there — or isn't what we wrote — reads back as
// null. Three things can go wrong, and each one used to be handled differently
// depending on which hand-rolled block you landed in (issue #352):
//
//   - Storage is absent or blocked. Touching `sessionStorage` itself throws a
//     SecurityError when a browser has storage disabled, so even the property
//     access is guarded; the client's vitest environment simply has no Storage.
//   - `setItem` throws QuotaExceededError when the store is full (or, in
//     Safari private mode historically, always).
//   - The stored JSON is corrupt or has the wrong shape, e.g. written by an
//     older build of the app.

function getStorage(): globalThis.Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read `key`, parse it as JSON, and hand the result to `validate` to narrow it
 * to the caller's shape. Returns null when the key is missing, the value is
 * unparseable, or `validate` rejects it.
 *
 * The validator is a required argument on purpose: it's the shape check that
 * keeps a corrupted entry from surfacing as a plausible-looking object with
 * undefined fields, and making it optional invites exactly the drift this
 * module exists to prevent.
 */
export function readStorageJson<T>(
  key: string,
  validate: (value: unknown) => T | null
): T | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Serialize `value` to `key`. Silently does nothing if storage rejects it. */
export function writeStorageJson(key: string, value: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded, or storage unavailable — see the module comment.
  }
}

/** Delete `key`. Silently does nothing if storage is unavailable. */
export function removeStorageItem(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // See the module comment.
  }
}
