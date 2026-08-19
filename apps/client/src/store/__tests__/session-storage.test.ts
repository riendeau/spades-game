import { beforeEach, describe, expect, it } from 'vitest';

// The client tests run in vitest's default node environment, which has no Web
// Storage, so these install their own. `throwOnAccess` covers the browsers that
// throw a SecurityError from the property access itself when storage is
// disabled — the case that has to be handled before getItem is ever reached.
let throwOnAccess = false;
let failWrites = false;
const data = new Map<string, string>();

const stub: Storage = {
  get length() {
    return data.size;
  },
  key: (i: number) => [...data.keys()][i] ?? null,
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (failWrites) throw new DOMException('quota', 'QuotaExceededError');
    data.set(key, value);
  },
  removeItem: (key: string) => {
    if (failWrites) throw new DOMException('quota', 'QuotaExceededError');
    data.delete(key);
  },
  clear: () => data.clear(),
};

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  get() {
    if (throwOnAccess) throw new DOMException('denied', 'SecurityError');
    return stub;
  },
});

const { readStorageJson, writeStorageJson, removeStorageItem } =
  await import('../session-storage');

interface Entry {
  id: string;
}

function parseEntry(value: unknown): Entry | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id } = value as Record<string, unknown>;
  return typeof id === 'string' ? { id } : null;
}

beforeEach(() => {
  data.clear();
  throwOnAccess = false;
  failWrites = false;
});

describe('readStorageJson', () => {
  it('round-trips a value written by writeStorageJson', () => {
    writeStorageJson('k', { id: 'abc' });
    expect(readStorageJson('k', parseEntry)).toEqual({ id: 'abc' });
  });

  it('returns null when the key is absent', () => {
    expect(readStorageJson('k', parseEntry)).toBeNull();
  });

  it('returns null on unparseable JSON', () => {
    stub.setItem('k', 'not json');
    expect(readStorageJson('k', parseEntry)).toBeNull();
  });

  // The drift issue #352 called out: without a mandatory shape check a
  // corrupted entry reads back as a plausible object with undefined fields.
  it('returns null when the validator rejects the shape', () => {
    stub.setItem('k', JSON.stringify({ id: 42 }));
    expect(readStorageJson('k', parseEntry)).toBeNull();
  });

  it('returns null when a validator throws', () => {
    stub.setItem('k', JSON.stringify({ id: 'abc' }));
    expect(
      readStorageJson('k', () => {
        throw new Error('boom');
      })
    ).toBeNull();
  });

  it('returns null when storage access throws', () => {
    throwOnAccess = true;
    expect(readStorageJson('k', parseEntry)).toBeNull();
  });
});

describe('writeStorageJson', () => {
  it('swallows a quota error', () => {
    failWrites = true;
    expect(() => writeStorageJson('k', { id: 'abc' })).not.toThrow();
  });

  it('swallows a storage access error', () => {
    throwOnAccess = true;
    expect(() => writeStorageJson('k', { id: 'abc' })).not.toThrow();
  });
});

describe('removeStorageItem', () => {
  it('deletes the key', () => {
    writeStorageJson('k', { id: 'abc' });
    removeStorageItem('k');
    expect(readStorageJson('k', parseEntry)).toBeNull();
  });

  it('swallows a storage access error', () => {
    throwOnAccess = true;
    expect(() => removeStorageItem('k')).not.toThrow();
  });
});
