// Double of `@/lib/auth/admin-2fa-cookie`: freshness is set by `actAs()`.
type TestState = { __testFresh2fa?: boolean };

export async function hasFreshAdmin2faCookie(): Promise<boolean> {
  return (globalThis as TestState).__testFresh2fa === true;
}
export async function setAdmin2faCookie(): Promise<void> {}
export async function clearAdmin2faCookie(): Promise<void> {}
