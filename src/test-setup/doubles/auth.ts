// Double of `@/auth` for integration tests: the session is whatever
// `actAs()` (src/test-setup/db.ts) last set.
type TestState = { __testUserId?: string | null };

export async function auth(): Promise<{ user: { id: string } } | null> {
  const id = (globalThis as TestState).__testUserId;
  return id ? { user: { id } } : null;
}

export async function signIn(): Promise<never> {
  throw new Error('signIn is not available in integration tests');
}

export async function signOut(): Promise<void> {}
